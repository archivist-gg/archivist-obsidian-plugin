import type { App } from "obsidian";
import { setIcon } from "obsidian";
import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { EquipmentEntry, ResolvedEquipped } from "../../pc.types";
import type { CharacterEditState } from "../../pc.edit-state";
import { visibleItems, type FilterState, type VisibleEntry } from "./filter-state";
import { iconForEntity } from "./icon-mapping";
import { renderCustomItemInput } from "./custom-item-input";
import { renderRowExpand } from "./inventory-row-expand";

const COMPENDIUM_TYPES = ["weapon", "armor", "item"] as const;

// `search("", type, ENUMERATE_LIMIT)` is used as an enumeration shim because
// EntityRegistry exposes no `getAllByType`/`getAll` API. The empty query is
// treated as "match-all" by `RegisteredEntity.name.includes("")`.
const ENUMERATE_LIMIT = 10_000;

export interface BrowseModeOptions {
  filters: FilterState;
}

export class BrowseMode implements SheetComponent {
  readonly type = "browse-mode";

  constructor(private readonly opts: BrowseModeOptions) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-inv-browse" });
    const editState = ctx.editState;

    const candidates = collectCompendiumItems(ctx);
    const filtered = visibleItems(candidates, this.opts.filters);

    const banner = root.createDiv({ cls: "pc-inv-browse-banner" });
    banner.createSpan({
      cls: "pc-inv-browse-meta",
      text: `${filtered.length} of ${candidates.length} compendium items shown.`,
    });

    if (filtered.length === 0) {
      root.createDiv({
        cls: "pc-inv-empty",
        text: "No compendium items match. Adjust filters or add a custom item below.",
      });
    } else {
      const list = root.createDiv({ cls: "pc-inv-list" });
      // Expand state is per-render (closure scoped), keyed by slug since
      // browse-mode rows all share `index: -1` from the registry sweep.
      const expanded = new Set<string>();
      for (const v of filtered) {
        const rowHost = list.createDiv({ cls: "pc-inv-row-host" });
        drawBrowseRow(rowHost, v, editState, ctx.app, expanded);
      }
    }

    if (editState) {
      renderCustomItemInput(root, {
        onAdd: (text) => editState.addItem(text),
      });
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
): void {
  host.empty();
  const key = browseKey(v);
  const isExpanded = expanded.has(key);
  renderBrowseRow(host, v, editState, app, isExpanded, () => {
    if (expanded.has(key)) expanded.delete(key);
    else expanded.add(key);
    drawBrowseRow(host, v, editState, app, expanded);
  });
  if (isExpanded) {
    // Pass editState: null so renderRowExpand skips the PC-actions strip
    // (Equip / Attune / Remove are inventory-row concerns, not browse-mode).
    renderRowExpand(host, {
      entry: v.entry,
      resolved: v.resolved,
      app,
      editState: null,
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
): void {
  const row = parent.createDiv({ cls: "pc-inv-row" });
  if (isExpanded) row.classList.add("expanded");
  const e = v.resolved.entity as { name?: string; type?: string; rarity?: string; weight?: number; value?: number } | null;

  // Spacer for the toggle column (no toggle in browse mode)
  row.createDiv({ cls: "pc-inv-toggle-cell" });

  const iconCell = row.createDiv({ cls: "pc-inv-icon" });
  setIcon(iconCell, iconForEntity(v.resolved, v.entry));

  const nameCell = row.createDiv({ cls: "pc-inv-name-cell" });
  nameCell.createDiv({ cls: nameClass(e), text: e?.name ?? v.entry.item });
  const sub = nameCell.createDiv({ cls: "pc-inv-sub" });
  const parts: string[] = [];
  if (v.resolved.entityType) parts.push(capitalize(v.resolved.entityType));
  if (e?.type) parts.push(capitalize(e.type));
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
      if (slug) editState.addItem(slug);
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

function capitalize(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function collectCompendiumItems(ctx: ComponentRenderContext): VisibleEntry[] {
  // CoreAPI.entities IS the EntityRegistry directly. The registry has no
  // `getAllByType`; the closest enumeration is `search("", type, limit)`.
  const reg = ctx.core?.entities as
    | {
        search?: (
          query: string,
          entityType: string | undefined,
          limit?: number,
        ) => Array<{ slug: string; name?: string; entityType?: string; data?: object }>;
      }
    | undefined;

  const out: VisibleEntry[] = [];
  for (const type of COMPENDIUM_TYPES) {
    const all = reg?.search?.("", type, ENUMERATE_LIMIT) ?? [];
    for (const ent of all) {
      const entry: EquipmentEntry = { item: `[[${ent.slug}]]` };
      const entity = (ent.data ?? {}) as never;
      const entityType = ent.entityType ?? type;
      const resolved: ResolvedEquipped = { index: -1, entity, entityType, entry };
      out.push({ entry, resolved });
    }
  }
  return out;
}
