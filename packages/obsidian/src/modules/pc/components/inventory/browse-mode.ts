import type { App } from "obsidian";
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry, ResolvedEquipped } from "@archivist-gg/dnd5e/pc/pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import type { EntityRegistry } from "@archivist-gg/core";
import { visibleItems, type FilterState, type VisibleEntry } from "./filter-state";
import { iconForEntity } from "./icon-mapping";
import { setInventoryIcon } from "../../assets/inventory-icons";
import { renderRowExpand } from "./inventory-row-expand";
import { humanizeToken } from "../../../../shared/rendering/renderer-utils";
import { hiddenCompendiumSet, entityCompendiumVisible } from "../../../../shared/entities/compendium-visibility";

const COMPENDIUM_TYPES = ["weapon", "armor", "item"] as const;

// `search("", type, ENUMERATE_LIMIT)` is used as an enumeration shim because
// EntityRegistry exposes no `getAllByType`/`getAll` API. The empty query is
// treated as "match-all" by `RegisteredEntity.name.includes("")`.
const ENUMERATE_LIMIT = 10_000;

/** How many rows to show initially, and how many each "Load more" reveals. */
const PAGE = 50;

/**
 * Signature for the persisted shown-count, mirroring inventory-list's shownKey
 * but with a distinct `browse.shown:` prefix — BrowseMode is also mounted by
 * equipment-step.ts, so a namespaced key avoids colliding with the owned
 * inventory list. Keyed by the active filters so the count survives sheet
 * re-renders but resets to PAGE whenever a filter or the search text changes.
 */
function browseShownKey(f: FilterState): string {
  const types = [...f.types].sort().join(",");
  const rarities = [...f.rarities].sort().join(",");
  return `browse.shown:${f.status}|${types}|${rarities}|${f.search}`;
}

export interface BrowseModeOptions {
  filters: FilterState;
  /** When set, the "+ Add" handler tags each added item with this provenance
   *  string via `addItem(slug, { granted_by })` (e.g. "builder:gold-buy" so the
   *  Equipment step can sum/clear gold-bought gear). Omit (the default) for the
   *  inventory Add drawer — items are added with no provenance, unchanged. */
  addProvenance?: string;
}

export class BrowseMode implements SheetComponent {
  readonly type = "browse-mode";

  constructor(private readonly opts: BrowseModeOptions) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-inv-browse" });
    const editState = ctx.editState;

    const collected = collectCompendiumItems(ctx);
    const filtered = visibleItems(collected, this.opts.filters);

    const banner = root.createDiv({ cls: "pc-inv-browse-banner" });
    banner.createSpan({
      cls: "pc-inv-browse-meta",
      text: `${filtered.length} of ${collected.length} compendium items shown.`,
    });

    if (filtered.length === 0) {
      root.createDiv({
        cls: "pc-inv-empty",
        text: "No compendium items match. Adjust filters.",
      });
    } else {
      const list = root.createDiv({ cls: "pc-inv-list" });
      // Expand state is per-render (closure scoped), keyed by slug since
      // browse-mode rows all share `index: -1` from the registry sweep. Declared
      // once here so single-row expand survives load-more repaints.
      const expanded = new Set<string>();
      const registry = (ctx.services?.entities as EntityRegistry | undefined) ?? null;
      const addProvenance = this.opts.addProvenance;

      // Shown-count lives in the per-file builderUiState bag (namespaced with a
      // `browse.shown:` prefix) so it survives whole-sheet re-renders; when the
      // bag is absent we fall back to a render-scoped local (resets each render).
      const bag = ctx.builderUiState;
      const key = browseShownKey(this.opts.filters);
      const local = { shown: PAGE };
      const getShown = (): number =>
        bag ? ((bag.get(key) as number | undefined) ?? PAGE) : local.shown;
      const setShown = (n: number): void => {
        if (bag) bag.set(key, n);
        else local.shown = n;
      };

      const paint = (): void => {
        list.empty();
        const shown = getShown();
        for (const v of filtered.slice(0, shown)) {
          const rowHost = list.createDiv({ cls: "pc-inv-row-host" });
          drawBrowseRow(rowHost, v, editState, ctx.app, expanded, registry, addProvenance);
        }
        if (filtered.length > shown) {
          const remaining = filtered.length - shown;
          const wrap = list.createDiv({ cls: "pc-inv-loadmore" });
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
}

function browseKey(v: VisibleEntry): string {
  return v.entry.item;
}

function drawBrowseRow(
  host: HTMLElement,
  v: VisibleEntry,
  editState: CharacterEditState | null,
  app: App,
  expanded: Set<string>,
  registry: EntityRegistry | null,
  addProvenance?: string,
): void {
  host.empty();
  const key = browseKey(v);
  const isExpanded = expanded.has(key);
  renderBrowseRow(host, v, editState, app, isExpanded, () => {
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    drawBrowseRow(host, v, editState, app, expanded, registry, addProvenance);
  }, addProvenance);
  if (isExpanded) {
    // Pass editState: null so renderRowExpand skips the PC-actions strip
    // (Equip / Attune / Remove are inventory-row concerns, not browse-mode).
    renderRowExpand(host, {
      entry: v.entry,
      resolved: v.resolved,
      app,
      editState: null,
      registry,
    });
  }
}

function renderBrowseRow(
  parent: HTMLElement,
  v: VisibleEntry,
  editState: CharacterEditState | null,
  _app: App,
  isExpanded: boolean,
  onToggle: () => void,
  addProvenance?: string,
): void {
  const row = parent.createDiv({ cls: "pc-inv-row" });
  if (isExpanded) row.classList.add("expanded", "pc-row-open");
  const e = v.resolved.entity as { name?: string; type?: string; rarity?: string; weight?: number; value?: number } | null;

  // Spacer for the toggle column (no toggle in browse mode)
  row.createDiv({ cls: "pc-inv-toggle-cell" });

  const iconCell = row.createDiv({ cls: "pc-inv-icon" });
  setInventoryIcon(iconCell, iconForEntity(v.resolved, v.entry));

  const nameCell = row.createDiv({ cls: "pc-inv-name-cell" });
  nameCell.createDiv({ cls: nameClass(e), text: e?.name ?? v.entry.item });
  const sub = nameCell.createDiv({ cls: "pc-inv-sub" });
  const parts: string[] = [];
  if (v.resolved.entityType) parts.push(humanizeToken(v.resolved.entityType));
  if (e?.type) parts.push(humanizeToken(e.type));
  if (e?.rarity) parts.push(e.rarity);
  sub.setText(parts.join(" · "));

  row.createDiv({ cls: "pc-inv-stat", text: "" });
  row.createDiv({ cls: "pc-inv-weight", text: e?.weight ? `${e.weight} lb` : "—" });

  const addCell = row.createDiv();
  if (editState) {
    const add = addCell.createEl("button", { cls: "pc-inv-add-mini" });
    add.appendText("+ Add");
    add.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const slug = v.entry.item.match(/^\[\[(.+)\]\]$/)?.[1];
      // Backward-compatible: with no addProvenance (the inventory Add drawer),
      // this is addItem(slug, {}) — no granted_by, unchanged behavior.
      if (slug) editState.addItem(slug, addProvenance ? { granted_by: addProvenance } : {});
    });
  }

  // Row click toggles inline expand. Must come after the +Add wiring so the
  // button's stopPropagation has somewhere to stop.
  row.addEventListener("click", () => onToggle());
}

function nameClass(e: { rarity?: string } | null): string {
  const r = e?.rarity?.toLowerCase().replace(/\s+/g, "-") ?? "";
  const rarityCls = ["uncommon", "rare", "very-rare", "legendary", "artifact"].includes(r) ? `rarity-${r}` : "";
  return `pc-inv-name${rarityCls ? " " + rarityCls : ""}`;
}

function collectCompendiumItems(ctx: ComponentRenderContext): VisibleEntry[] {
  // PCServices.entities IS the EntityRegistry directly. The registry has no
  // `getAllByType`; the closest enumeration is `search("", type, limit)`.
  const reg = ctx.services?.entities as
    | {
        search?: (
          query: string,
          entityType: string | undefined,
          limit?: number,
        ) => Array<{ slug: string; name?: string; entityType?: string; data?: object; compendium?: string }>;
      }
    | undefined;

  const hidden = hiddenCompendiumSet(ctx.services?.plugin?.settings);
  const out: VisibleEntry[] = [];
  for (const type of COMPENDIUM_TYPES) {
    const all = reg?.search?.("", type, ENUMERATE_LIMIT) ?? [];
    for (const ent of all) {
      if (!entityCompendiumVisible(ent, hidden)) continue;
      const entry: EquipmentEntry = { item: `[[${ent.slug}]]` };
      const entity = (ent.data ?? {}) as never;
      const entityType = ent.entityType ?? type;
      const resolved: ResolvedEquipped = { index: -1, entity, entityType, entry };
      out.push({ entry, resolved });
    }
  }
  return out;
}
