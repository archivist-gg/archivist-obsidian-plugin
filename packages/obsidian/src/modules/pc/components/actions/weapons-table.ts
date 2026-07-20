import type { ComponentRenderContext } from "../component.types";
import type { AttackRow, EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { ActionEntry } from "./action-model";
import { renderConditionTag } from "../condition-tag";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { renderSituationalRows } from "../situational-rows";
import { renderTextWithInlineTags } from "../../../../shared/rendering/renderer-utils";

const attackDisSources = new Set([
  "blinded", "frightened", "poisoned", "prone", "restrained", "grappled", "exhaustion",
]);

/**
 * Render the whole weapons sub-group (header + rows) into `list`. The section
 * renderer stays generic and hands the raw sub-group entries here; all
 * weapon-specific logic (the once-per-group has-mastery scan, the labeled
 * header row, threading `hasMastery` into each row) lives in this file.
 *
 * When ANY entry carries 2024 weapon mastery, a labeled header row renders
 * (a blank leading cell over the cost badge, then Name · Range · Hit · Damage ·
 * Mastery) and every row switches to the 6-col has-mastery grid so the Mastery
 * column lines up. A group with no mastery renders no header and keeps the
 * unchanged 5-col grid.
 */
export function renderWeaponsGroup(
  list: HTMLElement,
  entries: ActionEntry[],
  ctx: ComponentRenderContext,
): void {
  const attacks = entries
    .filter((e): e is Extract<ActionEntry, { kind: "weapon" }> => e.kind === "weapon")
    .map((e) => e.attack);
  const hasMastery = attacks.some((a) => !!a.mastery);

  if (hasMastery) {
    const header = list.createDiv({ cls: "pc-weapon-header has-mastery" });
    header.createDiv({ cls: "pc-weapon-header-cost" }); // blank leading cell over the cost badge
    header.createDiv({ cls: "pc-weapon-header-cell", text: "Name" });
    header.createDiv({ cls: "pc-weapon-header-cell", text: "Range" });
    header.createDiv({ cls: "pc-weapon-header-cell", text: "Hit" });
    header.createDiv({ cls: "pc-weapon-header-cell", text: "Damage" });
    header.createDiv({ cls: "pc-weapon-header-cell pc-weapon-header-mastery", text: "Mastery" });
  }

  for (const a of attacks) renderWeaponRow(list, a, ctx, hasMastery);
}

/**
 * Render ONE weapon attack as a `.pc-action-row` (plus its sibling
 * `.pc-action-expand` panel, hidden until clicked) into `list`. No section head,
 * no self-redraw: the row-click toggles `expand.hidden` + the `.pc-row-open`
 * class IN PLACE — the same cheap `hidden`-toggle the feature rows use in
 * actions-tab.ts — so a containing tab (Task 5) can file each row under its own
 * economy×source sub-group without redrawing the whole table.
 *
 * Everything display-only (cost badge, range, to-hit / damage inline tags,
 * condition/roll-modifier chips, damage riders, versatile, crit caption,
 * situational sub-line) is preserved verbatim from the former in-loop builder.
 *
 * `hasMastery` is the group-level flag from `renderWeaponsGroup`: when set, the
 * row switches to the 6-col has-mastery grid and (for a row that actually has
 * mastery) renders a real trailing `.pc-weapon-mastery` grid cell. It is
 * OPTIONAL (defaults false) so existing 3-arg callers keep the unchanged 5-col
 * grid with no Mastery column.
 */
export function renderWeaponRow(
  list: HTMLElement,
  a: AttackRow,
  ctx: ComponentRenderContext,
  hasMastery = false,
): void {
  const row = list.createDiv({ cls: "pc-action-row" });
  if (hasMastery) row.addClass("has-mastery");

  // Cost
  const costCell = row.createDiv({ cls: "pc-weapon-cost" });
  const cost: ActionCost = a.actionCost ?? "action";
  renderCostBadge(costCell, cost);

  // Name + sub
  const nameCell = row.createDiv({ cls: "pc-weapon-name" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: a.name });
  if (a.subLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: a.subLabel });
  // Attack notes (reroll-damage / attack-rule captions) — muted line under
  // the weapon name. Display-only; joined with " · ". Absent when no
  // annotation effect mapped a list onto this row.
  if (a.attackNotes?.length) {
    nameCell.createDiv({ cls: "pc-weapon-note", text: a.attackNotes.join(" · ") });
  }

  // Range
  row.createDiv({ cls: "pc-weapon-range", text: a.range ?? "" });

  // Hit (inline italic)
  const hitCell = row.createDiv({ cls: "pc-weapon-hit" });
  renderTextWithInlineTags(`\`atk:${formatSigned(a.toHit)}\``, hitCell, false);

  const ce = ctx.derived.conditionEffects;
  if (ce) {
    if (ce.attack_disadvantage) {
      const sources = ce.sources
        .filter((s) => attackDisSources.has(s.condition))
        .map((s) => s.condition === "exhaustion" ? `exhaustion ${s.level}` : s.condition);
      renderConditionTag(hitCell, "DIS", `Disadvantage from ${sources.join(", ")}`);
    }
    if (ce.attack_advantage) {
      renderConditionTag(hitCell, "ADV", `Advantage from invisible`);
    }
    const isAction = cost === "action" || cost === "reaction" || cost === "bonus-action";
    if (isAction && ce.actions_disabled) row.addClass("pc-row-disabled");
  }

  // Structured roll-modifier effects scoped to attacks (feature-granted
  // advantage/disadvantage). Order-preserving; one chip per matching entry.
  for (const rm of ctx.derived.rollModifiers ?? []) {
    if (rm.roll !== "attack") continue;
    const tag = rm.mode === "advantage" ? "ADV" : "DIS";
    const tip = rm.condition ? `${rm.label}: ${rm.condition}` : rm.label;
    renderConditionTag(hitCell, tag, tip);
  }

  // Damage (inline italic; versatile shows both stacked)
  const dmgCell = row.createDiv({ cls: "pc-weapon-damage" });
  renderTextWithInlineTags(
    `\`damage:${a.damageDice}${a.damageType ? " " + a.damageType : ""}\``,
    dmgCell,
    false,
  );
  if (a.damageRiders?.length) {
    for (const rider of a.damageRiders) {
      dmgCell.appendText(" + ");
      const dice = rider.damage_type ? `${rider.amount} ${rider.damage_type}` : rider.amount;
      renderTextWithInlineTags(`\`damage:${dice}\``, dmgCell, false);
      // Attribute the rider to its source on hover (source is NOT shown
      // inline — it disambiguates same-type chips, e.g. two necrotic riders).
      if (rider.source) {
        const chips = dmgCell.querySelectorAll(".archivist-tag-damage");
        const chip = chips[chips.length - 1] as HTMLElement | undefined;
        if (chip) chip.title = chip.title ? `${chip.title} — ${rider.source}` : rider.source;
      }
    }
  }
  if (a.versatile?.damageDice) {
    dmgCell.createEl("br");
    renderTextWithInlineTags(`\`damage:${a.versatile.damageDice}\``, dmgCell, false);
    dmgCell.appendText(" two-handed");
  }
  // Expanded crit threshold caption (e.g. "crit 19–20") from a crit-range
  // feature effect. Display-only; shown whenever the row carries a lowered
  // critRange (the recalc fold leaves it undefined at the normal 20).
  if (a.critRange && a.critRange < 20) {
    dmgCell.createSpan({ cls: "pc-weapon-crit", text: `crit ${a.critRange}–20` });
  }

  // 2024 Weapon Mastery: a REAL trailing 6th grid cell (only when the group
  // carries mastery AND this row has it): the label chip stacked over a compact
  // one-line summary, e.g. topple "Save DC 13 · on fail: Prone" (the derived
  // number is dropped for the non-numeric masteries, leaving just the gist).
  // The full glossary prose lives in the row-expand card (weapon.renderer), not
  // on hover. Absent (no cell) on rows without mastery, so the column stays
  // aligned by the has-mastery grid template with an empty 6th track.
  if (hasMastery && a.mastery) {
    const masteryCell = row.createDiv({ cls: "pc-weapon-mastery" });
    masteryCell.createSpan({ cls: "pc-meta-chip pc-mastery-tag", text: a.mastery.label });
    const d = a.mastery.derived;
    const gistText = `${d ? `${d.label} ${d.value} · ` : ""}${a.mastery.gist ?? ""}`;
    masteryCell.createDiv({ cls: "pc-weapon-mastery-gist", text: gistText });
  }

  // Expand block = a full-width sibling div AFTER the row, rendered once and
  // toggled via `hidden` (no container redraw). Built eagerly like the feature
  // rows; the inventory expand is a pure read of the resolved equipment.
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  const entry = findEntryForAttack(ctx, a);
  const resolved = findResolvedForAttack(ctx, a);
  if (entry && resolved) {
    renderInventoryRowExpand(inner, {
      entry, resolved, app: ctx.app, editState: ctx.editState,
      registry: ctx.services?.entities ?? null,
      mastery: a.mastery,
    });
  } else {
    inner.createDiv({ cls: "pc-action-row-sub", text: "(no item record for this attack)" });
  }

  // Situational sub-line — full-width sibling div (was a colspan row).
  // Inner rows are rendered by the shared situational-rows helper. Sits after
  // the expand panel, always visible (independent of expand state).
  const info = a.informational;
  if (info && info.length > 0) {
    const sub = list.createDiv({ cls: "pc-attack-row-situational" });
    renderSituationalRows(sub, info, {
      fieldLabel: (f) => (f === "weapon_attack" ? "to hit" : f === "weapon_damage" ? "dmg" : ""),
    });
  }

  // Click anywhere on the row toggles the expand panel in place (matches
  // inventory UX). Inner controls (dice tags) call e.stopPropagation() on their
  // own listeners below so their clicks don't bubble up here.
  row.addEventListener("click", () => {
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });

  // Dice tags rolled inline — prevent bubbling to the row click.
  hitCell.querySelectorAll(".archivist-tag").forEach((s) =>
    s.addEventListener("click", (e) => e.stopPropagation()),
  );
  dmgCell.querySelectorAll(".archivist-tag").forEach((s) =>
    s.addEventListener("click", (e) => e.stopPropagation()),
  );
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function findEntryForAttack(ctx: ComponentRenderContext, a: AttackRow): EquipmentEntry | null {
  const equipment = ctx.resolved.definition.equipment ?? [];
  const matchingSlot = equipment.find((e) => e.slot === a.slotKey && e.equipped);
  if (matchingSlot) return matchingSlot;
  return null;
}

function findResolvedForAttack(ctx: ComponentRenderContext, a: AttackRow): ResolvedEquipped | null {
  const entry = findEntryForAttack(ctx, a);
  if (!entry) return null;
  const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
  if (!slug) return null;
  const reg = ctx.services?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: object } | null } | undefined;
  const found = reg?.getBySlug?.(slug);
  if (!found) return null;
  const idx = ctx.resolved.definition.equipment?.indexOf(entry) ?? -1;
  return {
    index: idx,
    entity: (found.data ?? null) as ResolvedEquipped["entity"],
    entityType: found.entityType ?? null,
    entry,
  };
}
