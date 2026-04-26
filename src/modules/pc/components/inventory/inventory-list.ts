import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import { InventoryRow } from "./inventory-row";
import { renderRowExpand } from "./inventory-row-expand";
import { visibleItems, type FilterState, type VisibleEntry } from "./filter-state";

const DEFAULT_FILTERS: FilterState = {
  status: "all",
  types: new Set(),
  rarities: new Set(),
  search: "",
};

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

    const expanded = new Set<number>();

    for (const item of filtered) {
      const rowHost = root.createDiv({ cls: "pc-inv-row-host" });
      drawRow(rowHost, item, ctx, expanded, this.opts.onAttuneConflict);
    }
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
    onToggle,
    expanded: isExpanded,
  });
  if (isExpanded) {
    renderRowExpand(host, {
      entry: item.entry,
      resolved: item.resolved,
      app: ctx.app,
      editState: ctx.editState,
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
  // CoreAPI.entities is the EntityRegistry directly (see src/core/module-api.ts:103
  // and src/modules/pc/pc.equipment.ts:55 which calls registry.getBySlug). No
  // `.registry` sublevel — getBySlug lives on entities itself.
  const reg = (ctx.core?.entities as { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null | undefined } | undefined);
  const found = reg?.getBySlug?.(slug);
  if (!found) return { index, entity: null, entityType: null, entry };
  return { index, entity: (found.data ?? {}) as never, entityType: found.entityType ?? null, entry };
}

function parseSlug(item: string): string | null {
  const m = item.match(/^\[\[(.+)\]\]$/);
  return m ? m[1] : null;
}
