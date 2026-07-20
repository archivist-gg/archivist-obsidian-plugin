import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import { InventoryRow } from "./inventory-row";
import { renderRowExpand } from "./inventory-row-expand";
import { visibleItems, type FilterState, type VisibleEntry } from "./filter-state";

const DEFAULT_FILTERS: FilterState = {
  status: "all",
  types: new Set(),
  rarities: new Set(),
  search: "",
};

/** How many rows to show initially, and how many each "Load more" reveals. */
const PAGE = 50;

/**
 * Signature for the persisted shown-count. Keyed by the active filters so the
 * count survives inventory mutations (equip / attune / edit re-render the whole
 * sheet — see pc.sheet.ts root.empty()) but resets to PAGE whenever the user
 * changes a filter or the search text.
 */
function shownKey(f: FilterState): string {
  const types = [...f.types].sort().join(",");
  const rarities = [...f.rarities].sort().join(",");
  return `inventory.shown:${f.status}|${types}|${rarities}|${f.search}`;
}

export interface InventoryListOptions {
  filters?: FilterState;
  onAttuneConflict?: (incomingIndex: number) => void;
}

export class InventoryList implements SheetComponent {
  readonly type = "inventory-list";

  constructor(private readonly opts: InventoryListOptions = {}) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-inv-list" });
    const filters = this.opts.filters ?? DEFAULT_FILTERS;
    const items = collectItems(ctx);
    const filtered = visibleItems(items, filters);

    if (filtered.length === 0) {
      root.createDiv({
        cls: "pc-inv-empty",
        text: items.length === 0
          ? "No items in your inventory yet. Click \"Add Item\" to get started."
          : "No items match your filters. Clear them to see your full inventory.",
      });
      return;
    }

    // Expanded rows persist across load-more repaints (declared once here).
    const expanded = new Set<number>();

    // Shown-count lives in the per-file builderUiState bag so it survives the
    // whole-sheet re-render fired by any inventory mutation; when the bag is
    // somehow absent we fall back to a render-scoped local (resets each render).
    const bag = ctx.builderUiState;
    const key = shownKey(filters);
    const local = { shown: PAGE };
    const getShown = (): number =>
      bag ? ((bag.get(key) as number | undefined) ?? PAGE) : local.shown;
    const setShown = (n: number): void => {
      if (bag) bag.set(key, n);
      else local.shown = n;
    };

    const paint = (): void => {
      root.empty();
      const shown = getShown();
      for (const item of filtered.slice(0, shown)) {
        const rowHost = root.createDiv({ cls: "pc-inv-row-host" });
        drawRow(rowHost, item, ctx, expanded, this.opts.onAttuneConflict);
      }
      if (filtered.length > shown) {
        const remaining = filtered.length - shown;
        const wrap = root.createDiv({ cls: "pc-inv-loadmore" });
        const btn = wrap.createEl("button", {
          cls: "pc-inv-loadmore-btn",
          text: `Load more (${remaining})`,
        });
        btn.addEventListener("click", () => {
          setShown(shown + PAGE);
          paint();
        });
      }
    };

    paint();
  }
}

function drawRow(
  host: HTMLElement,
  item: VisibleEntry,
  ctx: ComponentRenderContext,
  expanded: Set<number>,
  onAttuneConflict?: (incomingIndex: number) => void,
): void {
  host.empty();
  const isExpanded = expanded.has(item.resolved.index);
  const onToggle = (i: number) => {
    if (expanded.has(i)) expanded.delete(i);
    else expanded.add(i);
    drawRow(host, item, ctx, expanded, onAttuneConflict);
  };
  new InventoryRow().render(host, {
    entry: item.entry,
    resolved: item.resolved,
    app: ctx.app,
    editState: ctx.editState,
    registry: ctx.services?.entities ?? null,
    sheet: ctx,
    onToggle,
    expanded: isExpanded,
  });
  if (isExpanded) {
    renderRowExpand(host, {
      entry: item.entry,
      resolved: item.resolved,
      app: ctx.app,
      editState: ctx.editState,
      registry: ctx.services?.entities ?? null,
      sheet: ctx,
      onAttuneConflict,
    });
  }
}

function collectItems(ctx: ComponentRenderContext): VisibleEntry[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  return equipment.map((entry, index) => ({
    entry,
    resolved: resolveEquipment(entry, index, ctx),
  }));
}

function resolveEquipment(entry: EquipmentEntry, index: number, ctx: ComponentRenderContext): ResolvedEquipped {
  const slug = parseSlug(entry.item);
  if (!slug) return { index, entity: null, entityType: null, entry };
  // PCServices.entities is the EntityRegistry directly (see
  // src/modules/pc/pc.equipment.ts:55 which calls registry.getBySlug). No
  // `.registry` sublevel — getBySlug lives on entities itself.
  const reg = (ctx.services?.entities as { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null | undefined } | undefined);
  const found = reg?.getBySlug?.(slug);
  if (!found) return { index, entity: null, entityType: null, entry };
  return { index, entity: (found.data ?? {}) as never, entityType: found.entityType ?? null, entry };
}

function parseSlug(item: string): string | null {
  const m = item.match(/^\[\[(.+)\]\]$/);
  return m ? m[1] : null;
}
