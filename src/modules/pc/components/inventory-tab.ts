import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { FilterState } from "./inventory/filter-state";
import { LoadoutStrip } from "./inventory/loadout-strip";
import { AttunementStrip } from "./inventory/attunement-strip";
import { showAttunePopover } from "./inventory/attune-popover";
import { CurrencyStrip } from "./inventory/currency-strip";
import { InventoryToolbar, type ToolbarMode } from "./inventory/inventory-toolbar";
import { InventoryFilters } from "./inventory/inventory-filters";
import { InventoryList } from "./inventory/inventory-list";

export class InventoryTab implements SheetComponent {
  readonly type = "inventory-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-inventory-body" });

    // Local UI state (not persisted)
    let mode: ToolbarMode = "list";
    let filters: FilterState = { status: "all", types: new Set(), rarities: new Set(), search: "" };

    const header = root.createDiv({ cls: "pc-inv-header" });
    const loadoutHost = header.createDiv({ cls: "pc-inv-header-loadout" });
    new LoadoutStrip().render(loadoutHost, ctx);
    const attuneHost = header.createDiv({ cls: "pc-inv-header-attune" });
    new AttunementStrip({
      onClickFilled: (occupant, anchor) => {
        if (!ctx.editState) return;
        const editState = ctx.editState;
        showAttunePopover({
          anchor,
          occupant,
          onUnattune: (i) => editState.unattuneItem(i),
          onFindInList: (_i) => { /* deferred — see "Deferred polish" section at end of plan */ },
        });
      },
    }).render(attuneHost, ctx);

    const toolbarHost = root.createDiv({ cls: "pc-inv-toolbar-host" });
    const filtersHost = root.createDiv({ cls: "pc-inv-filters-host" });
    const meta = root.createDiv({ cls: "pc-inv-meta" });
    const body = root.createDiv({ cls: "pc-inv-body" });

    const drawAll = (): void => {
      toolbarHost.empty();
      filtersHost.empty();
      meta.empty();
      body.empty();

      new InventoryToolbar({
        mode,
        initialSearch: filters.search,
        onSearch: (s) => { filters = { ...filters, search: s }; redrawBody(); },
        onAdd: () => { mode = "browse"; drawAll(); },
        onDone: () => { mode = "list"; drawAll(); },
      }).render(toolbarHost);

      new InventoryFilters({
        filters, mode,
        onChange: (next) => { filters = next; redrawBody(); },
      }).render(filtersHost);

      drawMeta();
      redrawBody();
    };

    const drawMeta = (): void => {
      meta.empty();
      const heading = meta.createEl("h4", { cls: "pc-tab-heading", text: "Inventory" });
      const carried = ctx.derived.carriedWeight ?? 0;
      const count = ctx.resolved.definition.equipment?.length ?? 0;
      heading.createSpan({
        cls: "pc-inv-meta-suffix",
        text: ` ${count} items · ${carried.toFixed(carried % 1 === 0 ? 0 : 1)} lb carried`,
      });
    };

    const redrawBody = (): void => {
      body.empty();
      if (mode === "list") {
        new InventoryList({ filters }).render(body, ctx);
      } else {
        body.createDiv({ cls: "pc-inv-empty", text: "Browse mode coming in Phase 9." });
      }
    };

    drawAll();

    const currencyHost = root.createDiv({ cls: "pc-inv-currency-host" });
    new CurrencyStrip().render(currencyHost, ctx);
  }
}
