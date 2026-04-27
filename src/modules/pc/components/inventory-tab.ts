import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { FilterState } from "./inventory/filter-state";
import type { EquipmentEntry, ResolvedEquipped } from "../pc.types";
import { HeaderStrip } from "./inventory/header-strip";
import { AttuneConflictModal } from "./inventory/attune-conflict-modal";
import { InventoryToolbar, type ToolbarMode } from "./inventory/inventory-toolbar";
import { InventoryFilters } from "./inventory/inventory-filters";
import { InventoryList } from "./inventory/inventory-list";
import { BrowseMode } from "./inventory/browse-mode";

export class InventoryTab implements SheetComponent {
  readonly type = "inventory-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-inventory-body" });

    // Local UI state (not persisted)
    let mode: ToolbarMode = "list";
    let filters: FilterState = { status: "all", types: new Set(), rarities: new Set(), search: "" };

    const header = root.createDiv({ cls: "pc-inventory-header" });
    new HeaderStrip().render(header, ctx);

    const toolbarHost = root.createDiv({ cls: "pc-inv-toolbar-host" });
    const filtersHost = root.createDiv({ cls: "pc-inv-filters-host" });
    const meta = root.createDiv({ cls: "pc-inv-meta" });
    const body = root.createDiv({ cls: "pc-inv-body" });

    const drawAll = (): void => {
      toolbarHost.empty();
      meta.empty();

      new InventoryToolbar({
        mode,
        initialSearch: filters.search,
        onSearch: (s) => { filters = { ...filters, search: s }; redrawFiltersAndBody(); },
        onAdd: () => { mode = "browse"; drawAll(); },
        onDone: () => { mode = "list"; drawAll(); },
      }).render(toolbarHost);

      drawMeta();
      redrawFiltersAndBody();
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

    // Re-renders both the filters and the list/browse body. Used whenever
    // `filters` or `mode` changes via a chip click / search input. The toolbar
    // is intentionally NOT re-rendered here so the search input keeps focus
    // and value as the user types. See bug fix: clicking a chip a second time
    // to deselect requires the filters component to re-render with fresh state.
    const redrawFiltersAndBody = (): void => {
      filtersHost.empty();
      new InventoryFilters({
        filters, mode,
        onChange: (next) => { filters = next; redrawFiltersAndBody(); },
      }).render(filtersHost);

      body.empty();
      if (mode === "list") {
        new InventoryList({
          filters,
          onAttuneConflict: (idx) => openConflictModal(ctx, idx),
        }).render(body, ctx);
      } else {
        new BrowseMode({ filters }).render(body, ctx);
      }
    };

    drawAll();
  }
}

function buildResolved(
  entry: EquipmentEntry,
  index: number,
  reg: { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null } | undefined,
): ResolvedEquipped {
  const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
  const found = slug ? reg?.getBySlug?.(slug) : null;
  const entity = found ? ((found.data ?? {}) as never) : null;
  const entityType = found ? (found.entityType ?? null) : null;
  return { index, entity, entityType, entry };
}

function openConflictModal(ctx: ComponentRenderContext, incomingIndex: number): void {
  if (!ctx.editState) return;
  const editState = ctx.editState;
  const equipment = ctx.resolved.definition.equipment ?? [];
  const reg = ctx.core?.entities as { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null } | undefined;
  const incomingEntry = equipment[incomingIndex];
  if (!incomingEntry) return;

  const incoming = buildResolved(incomingEntry, incomingIndex, reg);
  const slots: ResolvedEquipped[] = [];
  equipment.forEach((entry, idx) => {
    if (entry.attuned) slots.push(buildResolved(entry, idx, reg));
  });

  new AttuneConflictModal(ctx.app, {
    slots,
    incoming,
    onSwap: (swapIndex) => {
      editState.unattuneItem(swapIndex);
      editState.attuneItem(incomingIndex);
    },
  }).open();
}
