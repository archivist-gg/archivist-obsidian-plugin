import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { FilterState, VisibleEntry } from "./inventory/filter-state";
import type { EquipmentEntry, ResolvedEquipped } from "../pc.types";
import { LoadoutStrip } from "./inventory/loadout-strip";
import { AttunementStrip } from "./inventory/attunement-strip";
import { showAttunePopover } from "./inventory/attune-popover";
import { AttunePickerModal } from "./inventory/attune-picker-modal";
import { AttuneConflictModal } from "./inventory/attune-conflict-modal";
import { requiresAttunement } from "./inventory/requires-attunement";
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
      onPickEmpty: (slotIdx) => {
        if (!ctx.editState) return;
        const editState = ctx.editState;
        const candidates = collectAttunableCandidates(ctx);
        new AttunePickerModal(ctx.app, {
          slotIndex: slotIdx,
          candidates,
          onPick: (entryIdx) => {
            const result = editState.attuneItem(entryIdx);
            if (result.kind === "rejected") {
              // Should not happen because picker filtered to non-attuned, but guard anyway.
              openConflictModal(ctx, entryIdx);
            }
          },
        }).open();
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
        new InventoryList({
          filters,
          onAttuneConflict: (idx) => openConflictModal(ctx, idx),
        }).render(body, ctx);
      } else {
        body.createDiv({ cls: "pc-inv-empty", text: "Browse mode coming in Phase 9." });
      }
    };

    drawAll();

    const currencyHost = root.createDiv({ cls: "pc-inv-currency-host" });
    new CurrencyStrip().render(currencyHost, ctx);
  }
}

function collectAttunableCandidates(ctx: ComponentRenderContext): VisibleEntry[] {
  const equipment = ctx.resolved.definition.equipment ?? [];
  const reg = ctx.core?.entities as { getBySlug?: (slug: string) => { entityType?: string; data?: object } | null } | undefined;
  const out: VisibleEntry[] = [];
  equipment.forEach((entry, index) => {
    if (entry.attuned) return;
    const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
    const found = slug ? reg?.getBySlug?.(slug) : null;
    const entity = found ? ((found.data ?? {}) as never) : null;
    const entityType = found ? (found.entityType ?? null) : null;
    if (!requiresAttunement(entity)) return;
    out.push({ entry, resolved: { index, entity, entityType, entry } });
  });
  return out;
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
