import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry } from "../../pc.types";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { attachExpandToggle, createExpandState } from "./row-expand";
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

    const table = section.createEl("table", { cls: "pc-actions-table pc-items-table" });
    const tbody = table.createEl("tbody");

    for (const r of rows) {
      const slug = r.entry.item.match(/^\[\[(.+)\]\]$/)?.[1] ?? "";
      const action = resolveItemAction(slug, r.entry);
      if (!action) continue;

      const key = `item:${r.index}`;
      const tr = tbody.createEl("tr", { cls: "pc-action-row" });
      if (this.expand.is(key)) tr.classList.add("open");

      // Cost
      renderCostBadge(tr.createEl("td"), action.cost);

      // Name + sub
      const nameCell = tr.createEl("td");
      const nameEl = nameCell.createDiv({ cls: "pc-action-row-name", text: r.entity?.name ?? slug });
      const rcls = RARITY_CLASS[(r.entity?.rarity ?? "").toLowerCase()];
      if (rcls) nameEl.classList.add(rcls);
      const subParts: string[] = [];
      if (r.entity?.rarity) subParts.push(r.entity.rarity);
      if (r.entry.attuned) subParts.push("attuned");
      if (subParts.length) nameCell.createDiv({ cls: "pc-action-row-sub", text: subParts.join(" · ") });

      // Range
      tr.createEl("td", { text: action.range ?? "" });

      // Charges
      const chgCell = tr.createEl("td");
      const charges = r.entry.state?.charges;
      const recovery = r.entry.state?.recovery ?? action.recovery;
      if (charges) {
        renderChargeBoxes(chgCell, {
          used: charges.max - charges.current,
          max: charges.max,
          recovery,
          onExpend: () => ctx.editState?.expendCharge(r.index),
          onRestore: () => ctx.editState?.restoreCharge(r.index),
        });
      } else {
        chgCell.createSpan({ text: "—" });
      }

      // Caret
      attachExpandToggle(tr.createEl("td"), key, (k) => {
        this.expand.toggle(k);
        el.empty();
        this.render(el, ctx);
      });

      // Expand row reuses inventory-row-expand
      if (this.expand.is(key)) {
        const exp = tbody.createEl("tr", { cls: "pc-action-expand-row" });
        const td = exp.createEl("td");
        td.setAttribute("colspan", "5");
        const inner = td.createDiv({ cls: "pc-action-expand-inner" });
        renderInventoryRowExpand(inner, {
          entry: r.entry,
          resolved: { index: r.index, entity: r.entity as never, entityType: r.entityType, entry: r.entry },
          app: ctx.app, editState: ctx.editState,
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
