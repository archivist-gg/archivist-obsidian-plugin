import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry } from "../../pc.types";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { createExpandState } from "./row-expand";
import { renderRowExpand as renderInventoryRowExpand } from "../inventory/inventory-row-expand";
import { resolveItemAction } from "../../../item/item.actions-map";

interface RowData {
  index: number;
  entry: EquipmentEntry;
  entity: { name?: string; rarity?: string; actions?: object } | null;
  entityType: string | null;
}

const RARITY_CLASS: Record<string, string> = {
  "common": "rarity-common", "uncommon": "rarity-uncommon", "rare": "rarity-rare",
  "very rare": "rarity-very-rare", "very-rare": "rarity-very-rare",
  "legendary": "rarity-legendary", "artifact": "rarity-artifact", "legacy": "rarity-legacy",
};

export class ItemsTable implements SheetComponent {
  readonly type = "items-table";
  private expand = createExpandState();

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const rows = collectRows(ctx);
    if (rows.length === 0) return;

    const section = el.createDiv({ cls: "pc-actions-section" });
    const head = section.createDiv({ cls: "pc-actions-section-head" });
    head.createSpan({ cls: "pc-actions-section-title", text: "Items" });
    head.createSpan({ cls: "pc-actions-section-count", text: `${rows.length} actions` });

    const list = section.createDiv({ cls: "pc-actions-table pc-items-table" });

    for (const r of rows) {
      const slug = r.entry.item.match(/^\[\[(.+)\]\]$/)?.[1] ?? "";
      const action = resolveItemAction(slug, r.entry);
      if (!action) continue;

      const key = `item:${r.index}`;
      const row = list.createDiv({ cls: "pc-action-row" });
      if (this.expand.is(key)) row.classList.add("open", "pc-row-open");

      // Cost
      renderCostBadge(row.createDiv(), action.cost);

      const ce = ctx.derived.conditionEffects;
      const isAction = action.cost === "action" || action.cost === "reaction" || action.cost === "bonus-action";
      if (ce && isAction && ce.actions_disabled) row.addClass("pc-row-disabled");

      // Name + sub
      const nameCell = row.createDiv({ cls: "pc-action-namecell" });
      const nameEl = nameCell.createDiv({ cls: "pc-action-row-name", text: r.entity?.name ?? slug });
      const rcls = RARITY_CLASS[(r.entity?.rarity ?? "").toLowerCase()];
      if (rcls) nameEl.classList.add(rcls);
      const subParts: string[] = [];
      if (r.entity?.rarity) subParts.push(r.entity.rarity);
      if (r.entry.attuned) subParts.push("attuned");
      if (subParts.length) nameCell.createDiv({ cls: "pc-action-row-sub", text: subParts.join(" · ") });

      // Range
      row.createDiv({ cls: "pc-action-range", text: action.range ?? "" });

      // Charges
      const chgCell = row.createDiv({ cls: "pc-action-charges" });
      const stateCharges = r.entry.state?.charges;
      const max = stateCharges?.max ?? action.max_charges ?? 0;
      const used = stateCharges ? Math.max(0, stateCharges.max - stateCharges.current) : 0;
      const recovery = r.entry.state?.recovery ?? action.recovery;
      if (max > 0) {
        renderChargeBoxes(chgCell, {
          used,
          max,
          recovery,
          onSet: (newUsed) => ctx.editState?.setItemCharges(r.index, newUsed, max),
        });
      } else {
        chgCell.createSpan({ text: "—" });
      }

      // Click anywhere on the row toggles the expand panel (matches inventory UX).
      // Charge boxes call e.stopPropagation() so their clicks don't bubble here.
      row.addEventListener("click", () => {
        this.expand.toggle(key);
        el.empty();
        this.render(el, ctx);
      });

      // Expand block = a full-width sibling div after the row (no table row, no colspan).
      if (this.expand.is(key)) {
        const exp = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
        const inner = exp.createDiv({ cls: "pc-action-expand-inner" });
        renderInventoryRowExpand(inner, {
          entry: r.entry,
          resolved: { index: r.index, entity: r.entity as never, entityType: r.entityType, entry: r.entry },
          app: ctx.app, editState: ctx.editState,
          registry: ctx.core?.entities ?? null,
        });
      }
    }
  }
}

function collectRows(ctx: ComponentRenderContext): RowData[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  return equipment
    .map((entry, index) => {
      const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
      if (!slug) return null;
      const reg = ctx.core?.entities as { getBySlug?: (s: string) => { entityType?: string; data?: object } | null } | undefined;
      const found = reg?.getBySlug?.(slug);
      const entityType = found?.entityType ?? null;
      // Skip weapons + armor — those go in the Weapons table, or surface in expand
      if (entityType === "weapon" || entityType === "armor") return null;
      // Must be equipped to surface
      if (!entry.equipped) return null;
      return { index, entry, entity: (found?.data ?? null) as RowData["entity"], entityType };
    })
    .filter((r): r is RowData => r !== null);
}
