import type { SheetComponent, ComponentRenderContext } from "./component.types";

export class InventoryTab implements SheetComponent {
  readonly type = "inventory-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-inventory-body" });
    const items = ctx.resolved.definition.equipment ?? [];

    root.createEl("h4", { cls: "pc-tab-heading", text: "Equipment" });
    if (items.length === 0) {
      root.createDiv({ cls: "pc-empty-line", text: "No items." });
    } else {
      const list = root.createEl("ul", { cls: "pc-inventory-list" });
      for (const it of items) {
        const li = list.createEl("li", { cls: "pc-inventory-item" });
        const isSlug = /^\[\[.+\]\]$/.test(it.item);
        const name = isSlug ? it.item.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : it.item;
        li.createSpan({ cls: "pc-item-name", text: name });
        if (it.qty && it.qty > 1) li.createSpan({ cls: "pc-item-qty", text: `×${it.qty}` });
        if (it.equipped) li.createSpan({ cls: "pc-item-badge pc-item-equipped", text: "equipped" });
        if (it.attuned) li.createSpan({ cls: "pc-item-badge pc-item-attuned", text: "attuned" });
      }
    }

    // Currency
    const c = ctx.resolved.state.currency;
    if (c) {
      root.createEl("h4", { cls: "pc-tab-heading", text: "Currency" });
      const row = root.createDiv({ cls: "pc-currency-row" });
      for (const [key, label] of [["pp", "PP"], ["gp", "GP"], ["ep", "EP"], ["sp", "SP"], ["cp", "CP"]] as const) {
        const cell = row.createDiv({ cls: "pc-currency-cell" });
        cell.createDiv({ cls: "pc-currency-val", text: `${c[key] ?? 0}` });
        cell.createDiv({ cls: "pc-currency-label", text: label });
      }
    }
  }
}
