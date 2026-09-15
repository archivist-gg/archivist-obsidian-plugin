import type { ComponentRenderContext } from "../component.types";
import type { ACTerm, AttackRow, EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { ActionEntry } from "./action-model";
import { renderConditionTag, MODE_CLASS } from "../condition-tag";
import { ROLL_MODE_TAG } from "@archivist-gg/dnd5e/pc/roll-tag-labels";
import type { ActionCost } from "@archivist-gg/dnd5e/types/resource";
import { renderCostBadge } from "./cost-badge";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";
import { renderSituationalRows } from "../situational-rows";
import { renderTextWithInlineTags } from "../../../../shared/rendering/renderer-utils";
import { CHOSEN_DAMAGE_TYPE_NOTE, isChosenDamageType, isRenderableDamageText } from "@archivist-gg/dnd5e/dnd/math";

const attackDisSources = new Set([
  "blinded", "frightened", "poisoned", "prone", "restrained", "grappled", "exhaustion",
]);

/**
 * Render the whole weapons sub-group (header + rows) into `list`. The section
 * renderer stays generic and hands the raw sub-group entries here; all
 * weapon-specific logic (the once-per-group has-mastery scan, the labeled
 * header row, threading `hasMastery` into each row) lives in this file.
 *
 * The labeled header ALWAYS renders: a blank leading cell over the cost badge,
 * then Name, Range, Hit, Damage over the base 5-col grid. The Mastery column
 * only renders when the group has a mastery weapon: the header then also gains
 * the `has-mastery` class plus a trailing Mastery cell, and every row switches
 * to the 6-col has-mastery grid so the Mastery column lines up. A group with no
 * mastery keeps the unchanged 5-col grid, now with column labels above it.
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

  const header = list.createDiv({ cls: "pc-weapon-header" });
  if (hasMastery) header.addClass("has-mastery");
  header.createDiv({ cls: "pc-weapon-header-cost" }); // blank leading cell over the cost badge
  // R4-G6b live rider F-C: each label carries its own class beside the shared one, completing the
  // idiom `pc-weapon-header-cost` and `pc-weapon-header-mastery` already used. The narrow tier moves
  // these cells onto a second grid line and needs to name them; a positional selector would read the
  // header by source order, which no rule in this partial does.
  header.createDiv({ cls: "pc-weapon-header-cell pc-weapon-header-name", text: "Name" });
  header.createDiv({ cls: "pc-weapon-header-cell pc-weapon-header-range", text: "Range" });
  header.createDiv({ cls: "pc-weapon-header-cell pc-weapon-header-hit", text: "Hit" });
  header.createDiv({ cls: "pc-weapon-header-cell pc-weapon-header-damage", text: "Damage" });
  if (hasMastery) {
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
 * situational sub-line) came verbatim from the former in-loop builder, with THREE
 * later changes: R4-G7 T6a routes a rider whose printed form cannot be a dice
 * chip to the row's `.pc-weapon-note` caption instead of into the damage text,
 * R4-G7 T8 RIDER-12 routes a rider that carries a `condition` there too, and
 * RIDER-13 routes a rider whose type is the player's `chosen` pick there, type-less.
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

  // Range — container so a throwable melee weapon can stack its thrown range
  // as a second muted line ("5 ft" over "20/60 ft").
  const rangeCell = row.createDiv({ cls: "pc-weapon-range" });
  rangeCell.createDiv({ cls: "pc-weapon-range-main", text: a.range ?? "" });
  if (a.thrownRange) {
    const thrown = rangeCell.createDiv({ cls: "pc-weapon-range-thrown", text: a.thrownRange });
    thrown.title = "Thrown range";
  }

  // Hit (inline italic)
  const hitCell = row.createDiv({ cls: "pc-weapon-hit" });
  renderTextWithInlineTags(`\`atk:${formatSigned(a.toHit)}\``, hitCell, false);

  const ce = ctx.derived.conditionEffects;
  if (ce) {
    if (ce.attack_disadvantage) {
      const sources = ce.sources
        .filter((s) => attackDisSources.has(s.condition))
        .map((s) => s.condition === "exhaustion" ? `exhaustion ${s.level}` : s.condition);
      renderConditionTag(hitCell, "dis", ROLL_MODE_TAG.disadvantage, `Disadvantage from ${sources.join(", ")}`);
    }
    if (ce.attack_advantage) {
      renderConditionTag(hitCell, "adv", ROLL_MODE_TAG.advantage, `Advantage from invisible`);
    }
    const isAction = cost === "action" || cost === "reaction" || cost === "bonus-action";
    if (isAction && ce.actions_disabled) row.addClass("pc-row-disabled");
  }

  // Structured roll-modifier effects scoped to attacks (feature-granted
  // advantage/disadvantage). Order-preserving; one chip per matching entry.
  for (const rm of ctx.derived.rollModifiers ?? []) {
    if (rm.roll !== "attack") continue;
    const tip = rm.condition ? `${rm.label}: ${rm.condition}` : rm.label;
    renderConditionTag(hitCell, MODE_CLASS[rm.mode], ROLL_MODE_TAG[rm.mode], tip);
  }

  // Damage (inline italic; versatile shows both stacked)
  const dmgCell = row.createDiv({ cls: "pc-weapon-damage" });
  renderTextWithInlineTags(
    `\`damage:${a.damageDice}${a.damageType ? " " + a.damageType : ""}\``,
    dmgCell,
    false,
  );
  if (a.damageRiders?.length) {
    // R4-G7 T6a E-4 (c): a damage chip is a ROLL, so only a dice expression or a number (optionally
    // with a canonical damage type) may go inside the damage text. A rider whose amount is prose
    // ("your Wisdom modifier", "half your fighter level") is collected here and printed as the row's
    // CAPTION instead, beside the attack notes under the weapon name. The amount and the damage type
    // arrive already resolved (the engine's merge site), so what is prose here is prose in the DATA.
    // R4-G7 T8 RIDER-12: a rider that carries a `condition` is not damage on every hit, so it goes to the
    // caption as well, with its condition after its source, whatever its amount: the decision is the
    // FIELD, never the condition's wording. The damage cell keeps the unconditional riders only.
    // R4-G7 T8 RIDER-13: a rider whose type is the schema's `chosen` sentinel (the engine keeps it, never
    // inherits the row's type) prints its amount with NO type, captioned with dnd5e's note for the player's
    // choice; the sentinel word itself is never printed.
    const riderCaptions: string[] = [];
    for (const rider of a.damageRiders) {
      const chosen = isChosenDamageType(rider.damage_type);
      const dice = rider.damage_type && !chosen ? `${rider.amount} ${rider.damage_type}` : rider.amount;
      if (chosen || rider.condition || !isRenderableDamageText(dice)) {
        const notes = [chosen ? CHOSEN_DAMAGE_TYPE_NOTE : undefined, rider.condition];
        riderCaptions.push(riderCaption(dice, rider.source, notes));
        continue;
      }
      dmgCell.appendText(" + ");
      renderTextWithInlineTags(`\`damage:${dice}\``, dmgCell, false);
      // Attribute the rider to its source on hover (source is NOT shown
      // inline — it disambiguates same-type chips, e.g. two necrotic riders).
      if (rider.source) {
        const chips = dmgCell.querySelectorAll(".archivist-tag-damage");
        const chip = chips[chips.length - 1] as HTMLElement | undefined;
        if (chip) chip.title = chip.title ? `${chip.title} — ${rider.source}` : rider.source;
      }
    }
    // One caption line for every rider that could not be a chip, in the `.pc-weapon-note` idiom the
    // attack notes already use (a muted line under the weapon name), joined by the same " · ".
    if (riderCaptions.length) {
      nameCell.createDiv({ cls: "pc-weapon-note", text: riderCaptions.join(" · ") });
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
  // AttackRow.id is `${index}:standard` for a weapon slot and `unarmed-strike`
  // for the engine's unarmed row (R4-G6b §5): unique per equipped weapon slot
  // and self-healing on index shift (same D1 contract as the item rows).
  const expandKey = rowExpandKey("weapon", a.id);
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  const expanded = isRowExpanded(ctx, expandKey);
  expand.hidden = !expanded;
  if (expanded) row.classList.add("open", "pc-row-open");
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  if (a.unarmed) {
    // R4-G6b §5.5: the engine's unarmed row has no equipment entry. Gate BEFORE the lookup:
    // `findEntryForAttack` compares `e.slot === a.slotKey`, and `undefined === undefined` matches
    // the first equipped entry that carries no `slot` key, which would open another item's expand here.
    renderUnarmedCard(inner, a);
  } else {
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
    const nowOpen = !expand.hidden;
    row.classList.toggle("open", nowOpen);
    row.classList.toggle("pc-row-open", nowOpen);
    setRowExpanded(ctx, expandKey, nowOpen);
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

/** One rider caption in the T6a E-4 (c) idiom: `+ <amount and type>`, then in parentheses the source and, after a
 *  colon, the rider's notes joined by "; " (R4-G7 T8 RIDER-12 / RIDER-13): the player's-choice note for a `chosen`
 *  type, then the condition, `+ 2d8 radiant (Divine Smite: for a 1st-level spell slot)`. Any part may be absent;
 *  with none there are no parentheses. */
function riderCaption(dice: string, source: string | undefined, notes: (string | undefined)[]): string {
  const note = [source, notes.filter((s): s is string => !!s).join("; ")].filter((s): s is string => !!s).join(": ");
  return `+ ${dice}${note ? ` (${note})` : ""}`;
}

/** The unarmed row's expand: the two term lists, source + signed amount per row (R4-G6b §5.5). */
function renderUnarmedCard(host: HTMLElement, a: AttackRow): void {
  const card = host.createDiv({ cls: "pc-unarmed-card" });
  const list = (title: string, terms: ACTerm[]) => {
    card.createDiv({ cls: "pc-unarmed-card-head", text: title });
    for (const t of terms) {
      const row = card.createDiv({ cls: "pc-unarmed-card-row" });
      row.createSpan({ cls: "pc-unarmed-card-source", text: t.source });
      row.createSpan({ cls: "pc-unarmed-card-amount", text: formatSigned(t.amount) });
    }
  };
  list("To hit", a.breakdown.toHit);
  list("Damage", a.breakdown.damage);
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
