import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import {
  allTicked, matchesTicked, renderCompendiumFilter, renderSourceTag,
  type CompendiumTickState,
} from "./compendium-filter";
import { renderEntityBlock } from "./entity-block";

/** Reserved for the pinned ✦ Create-homebrew entry (parent spec §6). The
 *  Builder renders these in Plan 6; the option exists now so call-sites are
 *  stable. */
export interface PinnedEntry {
  label: string;
  onChoose: () => void;
}

export interface EntityPickerOptions {
  entityType: string;
  /** builderUiState key (query / ticks / focus survive full re-renders). */
  stateKey: string;
  /** Current definition value; its row shows ✓. */
  selectedSlug: string | null;
  /** Fired by the row toggle. Picker selection is single: picking swaps the
   *  previous choice (the caller writes the definition and re-renders). */
  onSelect: (slug: string) => void;
  pinnedEntries?: PinnedEntry[];
}

interface PickerUiState {
  query: string;
  ticked: CompendiumTickState | null;
  /** Row focused for reading; null falls back to selectedSlug. */
  detailSlug: string | null;
}

/** The universal two-pane picker (parent spec §6): searchable, compendium-
 *  filtered list left; the focused entity's real block right. Row click
 *  focuses; the row radio toggle selects (single-select). Persistent shell:
 *  the search input is built once and never rebuilt, so typing keeps focus
 *  through redraws. */
export function renderEntityPicker(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: EntityPickerOptions,
): void {
  const bag = ctx.builderUiState;
  const st: PickerUiState =
    (bag?.get(opts.stateKey) as PickerUiState | undefined) ??
    { query: "", ticked: null, detailSlug: null };
  bag?.set(opts.stateKey, st);

  const compendiums = ctx.core.compendiums.getAll();
  if (!st.ticked) st.ticked = allTicked(compendiums);

  const root = parent.createDiv({ cls: "pc-bpicker" });
  const left = root.createDiv({ cls: "pc-bpicker-left" });
  const search = left.createEl("input", {
    cls: "pc-bpicker-search",
    attr: { type: "text", placeholder: "Search…" },
  });
  search.value = st.query;
  const filterHost = left.createDiv({ cls: "pc-bpicker-filter" });
  const listHost = left.createDiv({ cls: "pc-bpicker-list" });
  const detail = root.createDiv({ cls: "pc-bpicker-detail" });

  const renderListRow = (e: RegisteredEntity, focusSlug: string | null): void => {
    const isSel = e.slug === opts.selectedSlug;
    const cls = `pc-bpicker-row${isSel ? " sel" : ""}${e.slug === focusSlug ? " focus" : ""}`;
    const row = listHost.createDiv({ cls });
    // Single-select: the selected row shows ✓; unselected rows show a hollow
    // radio circle (empty button). The ＋ glyph is reserved for multi-select.
    const toggle = isSel
      ? row.createEl("button", { cls: "pc-btoggle on", text: "✓" })
      : row.createEl("button", { cls: "pc-btoggle", text: "", attr: { title: "Select" } });
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!isSel) opts.onSelect(e.slug);
    });
    row.createSpan({ cls: "pc-bpicker-name", text: e.name });
    renderSourceTag(row, e);
    row.addEventListener("click", () => {
      st.detailSlug = e.slug;
      draw();
    });
  };

  const draw = (): void => {
    filterHost.empty();
    listHost.empty();
    detail.empty();
    renderCompendiumFilter(filterHost, compendiums, st.ticked!, draw);

    const cands = ctx.core.entities
      .search(st.query, opts.entityType, Number.POSITIVE_INFINITY)
      .filter((e) => matchesTicked(e, st.ticked!));
    if (!cands.length) listHost.createDiv({ cls: "pc-bpicker-empty", text: "No matches." });
    const focusSlug = st.detailSlug ?? opts.selectedSlug;
    for (const e of cands) renderListRow(e, focusSlug);

    // detailSlug is intentionally NOT cleared when the focused entity is filtered out:
    // the detail pane stays empty meanwhile, and focus returns if the filter re-includes it.
    const focused = focusSlug ? cands.find((c) => c.slug === focusSlug) : undefined;
    if (focused) renderEntityBlock(detail, focused, ctx.core);
  };

  search.addEventListener("input", () => {
    st.query = search.value;
    draw();
  });
  draw();
}
