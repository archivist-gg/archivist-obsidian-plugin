import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { AttackRow, EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import { renderConditionTag } from "../condition-tag";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { createExpandState } from "./row-expand";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { conditionsToText } from "../../../item/item.conditions";
import { renderTextWithInlineTags } from "../../../../shared/rendering/renderer-utils";

const attackDisSources = new Set([
  "blinded", "frightened", "poisoned", "prone", "restrained", "grappled", "exhaustion",
]);

export class WeaponsTable implements SheetComponent {
  readonly type = "weapons-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const attacks = ctx.derived.attacks ?? [];
    if (attacks.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Weapons" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${attacks.length} equipped` });

    const list = section.createDiv({ cls: "pc-actions-table pc-weapons-table" });

    for (const a of attacks) {
      const expandKey = `weapon:${a.slotKey ?? a.id ?? a.name}`;
      const row = list.createDiv({ cls: "pc-action-row" });

      // Cost
      const costCell = row.createDiv({ cls: "pc-weapon-cost" });
      const cost: ActionCost = a.actionCost ?? "action";
      renderCostBadge(costCell, cost);

      // Name + sub
      const nameCell = row.createDiv({ cls: "pc-weapon-name" });
      nameCell.createDiv({ cls: "pc-action-row-name", text: a.name });
      if (a.subLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: a.subLabel });

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
      if (a.extraDamage) {
        dmgCell.appendText(" + ");
        renderTextWithInlineTags(`\`damage:${a.extraDamage}\``, dmgCell, false);
      }
      if (a.versatile?.damageDice) {
        dmgCell.createEl("br");
        renderTextWithInlineTags(`\`damage:${a.versatile.damageDice}\``, dmgCell, false);
        dmgCell.appendText(" two-handed");
      }

      // Click anywhere on the row toggles the expand panel (matches inventory UX).
      // Inner controls (dice tags, etc.) call e.stopPropagation() on their own
      // listeners so their clicks don't bubble up here.
      row.addEventListener("click", () => this.toggleAndRedraw(el, ctx, expandKey));

      // Dice tags rolled inline — prevent bubbling to the row click.
      hitCell.querySelectorAll(".archivist-tag").forEach((s) =>
        s.addEventListener("click", (e) => e.stopPropagation()),
      );
      dmgCell.querySelectorAll(".archivist-tag").forEach((s) =>
        s.addEventListener("click", (e) => e.stopPropagation()),
      );

      // Expand block = a full-width sibling div after the row.
      if (this.expand.is(expandKey)) {
        row.classList.add("open", "pc-row-open");
        const exp = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
        const inner = exp.createDiv({ cls: "pc-action-expand-inner" });
        const entry = findEntryForAttack(ctx, a);
        const resolved = findResolvedForAttack(ctx, a);
        if (entry && resolved) {
          renderInventoryRowExpand(inner, {
            entry, resolved, app: ctx.app, editState: ctx.editState,
            registry: ctx.core?.entities ?? null,
          });
        } else {
          inner.createDiv({ cls: "pc-action-row-sub", text: "(no item record for this attack)" });
        }
      }

      // Situational sub-line — full-width sibling div (was a colspan row).
      const info = a.informational;
      if (info && info.length > 0) {
        const sub = list.createDiv({ cls: "pc-attack-row-situational" });
        for (const i of info) {
          const line = sub.createDiv({ cls: "pc-attack-row-situational-line" });
          line.createSpan({
            text: `${i.source}: ${formatSigned(i.value)} ${fieldLabel(i.field)} ${conditionsToText(i.conditions)}`,
          });
        }
      }
    }
  }

  private toggleAndRedraw(el: HTMLElement, ctx: ComponentRenderContext, key: string): void {
    this.expand.toggle(key);
    el.empty();
    this.render(el, ctx);
  }
}

function formatSigned(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function fieldLabel(field: string): string {
  if (field === "weapon_attack") return "to hit";
  if (field === "weapon_damage") return "dmg";
  return field;
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
  const reg = ctx.core?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: object } | null } | undefined;
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
