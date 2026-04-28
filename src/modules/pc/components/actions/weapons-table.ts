import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { AttackRow, EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import { renderCostBadge, type ActionCost } from "./cost-badge";
import { attachExpandToggle, createExpandState } from "./row-expand";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { conditionsToText } from "../../../item/item.conditions";

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

    const table = section.createEl("table", { cls: "pc-actions-table pc-weapons-table" });
    const tbody = table.createEl("tbody");

    for (const a of attacks) {
      const expandKey = `weapon:${a.slotKey ?? a.id ?? a.name}`;
      const row = tbody.createEl("tr", { cls: "pc-action-row" });

      // Cost
      const costCell = row.createEl("td", { cls: "pc-weapon-cost" });
      const cost: ActionCost = a.actionCost ?? "action";
      renderCostBadge(costCell, cost);

      // Name + sub
      const nameCell = row.createEl("td", { cls: "pc-weapon-name" });
      nameCell.createDiv({ cls: "pc-action-row-name", text: a.name });
      if (a.subLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: a.subLabel });

      // Range
      row.createEl("td", { cls: "pc-weapon-range", text: a.range ?? "" });

      // Hit (inline italic)
      const hitCell = row.createEl("td", { cls: "pc-weapon-hit" });
      const hitTag = hitCell.createSpan({ cls: "archivist-tag-atk", text: formatSigned(a.toHit) });
      hitTag.setAttribute("data-formula", String(a.toHit));

      // Damage (inline italic; versatile shows both stacked)
      const dmgCell = row.createEl("td", { cls: "pc-weapon-damage" });
      dmgCell.createSpan({ cls: "archivist-tag-damage", text: a.damageDice });
      if (a.damageType) dmgCell.appendText(` ${a.damageType}`);
      if (a.extraDamage) {
        dmgCell.appendText(" + ");
        dmgCell.createSpan({ cls: "archivist-tag-damage", text: a.extraDamage });
      }
      if (a.versatile?.damageDice) {
        dmgCell.createEl("br");
        dmgCell.createSpan({ cls: "archivist-tag-damage", text: a.versatile.damageDice });
        dmgCell.appendText(" two-handed");
      }

      // Caret
      const caretCell = row.createEl("td", { cls: "pc-weapon-caret" });
      attachExpandToggle(caretCell, expandKey, (k) => this.toggleAndRedraw(el, ctx, k));

      // Mark open if state is open
      if (this.expand.is(expandKey)) {
        row.classList.add("open");
        const expandTr = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = expandTr.createEl("td");
        td.setAttribute("colspan", "6");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        const entry = findEntryForAttack(ctx, a);
        const resolved = findResolvedForAttack(ctx, a);
        if (entry && resolved) {
          renderInventoryRowExpand(inner, { entry, resolved, app: ctx.app, editState: ctx.editState });
        } else {
          inner.createDiv({ cls: "pc-action-row-sub", text: "(no item record for this attack)" });
        }
      }

      // Situational sub-line — renders informational modifiers (advantage/disadvantage etc.)
      const info = a.informational;
      if (info && info.length > 0) {
        const sub = tbody.createEl("tr", { cls: "pc-attack-row-situational" });
        const td = sub.createEl("td");
        td.setAttribute("colspan", "6");
        for (const i of info) {
          const line = td.createDiv({ cls: "pc-attack-row-situational-line" });
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
