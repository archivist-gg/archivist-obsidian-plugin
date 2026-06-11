import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import {
  allTicked, matchesTicked, renderCompendiumFilter,
  type CompendiumTickState,
} from "./compendium-filter";
import { renderSelectionTable, type ColSpec } from "./selection-table";

/** Reserved for the pinned ✦ Create-homebrew entry (parent spec §6). The
 *  Builder renders these in Plan 6; the option exists now so call-sites are
 *  stable. */
export interface PinnedEntry {
  label: string;
  onChoose: () => void;
}

export interface EntityPickerOptions {
  entityType: string;
  /** builderUiState key (query / ticks survive full re-renders; the ledger's
   *  sort + expanded rows live under `${stateKey}.table`). */
  stateKey: string;
  /** Current definition value; its row carries the pressed seal + crimson name. */
  selectedSlug: string | null;
  /** Fired when a non-selected row's seal is clicked. Picker selection is
   *  single: picking swaps the previous choice (the caller writes the
   *  definition and re-renders); the selected seal is inert. */
  onSelect: (slug: string) => void;
  /** Extra ledger columns between the built-in Name and Source (e.g. Size /
   *  Speed for races). Keep the array stable for a given stateKey — the
   *  table's persisted sort key is column-index-based. */
  columns?: ColSpec[];
  pinnedEntries?: PinnedEntry[];
  /** Threads through to renderSelectionTable (race-step semantics). */
  expandSelect?: boolean;
  renderExpand?: (wrap: HTMLElement, entity: RegisteredEntity) => void;
}

interface PickerUiState {
  query: string;
  ticked: CompendiumTickState | null;
}

/** The universal entity picker as a single-select ledger: a persistent search
 *  input + compendium tick-filter over the shared selection table in seal
 *  dress. Row click unfolds the entity's real block inline (the add-drawer
 *  idiom, via the table); the seal takes the entity without opening it.
 *  Persistent shell: the search input is built once and never rebuilt, so
 *  typing keeps focus through redraws. */
export function renderEntityPicker(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: EntityPickerOptions,
): void {
  const bag = ctx.builderUiState;
  const st: PickerUiState =
    (bag?.get(opts.stateKey) as PickerUiState | undefined) ?? { query: "", ticked: null };
  bag?.set(opts.stateKey, st);

  const compendiums = ctx.core.compendiums.getAll();
  if (!st.ticked) st.ticked = allTicked(compendiums);

  const root = parent.createDiv({ cls: "pc-bpicker" });
  const search = root.createEl("input", {
    cls: "pc-bpicker-search",
    attr: { type: "text", placeholder: "Search…" },
  });
  search.value = st.query;
  const filterHost = root.createDiv({ cls: "pc-bpicker-filter" });
  const tableHost = root.createDiv({ cls: "pc-bpicker-table" });

  const draw = (): void => {
    filterHost.empty();
    tableHost.empty();
    renderCompendiumFilter(filterHost, compendiums, st.ticked!, draw);

    const cands = ctx.core.entities
      .search(st.query, opts.entityType, Number.POSITIVE_INFINITY)
      .filter((e) => matchesTicked(e, st.ticked!));
    renderSelectionTable(tableHost, ctx, {
      columns: opts.columns ?? [],
      candidates: cands,
      stateKey: `${opts.stateKey}.table`,
      selected: new Set(opts.selectedSlug ? [opts.selectedSlug] : []),
      onToggle: (slug) => {
        if (slug !== opts.selectedSlug) opts.onSelect(slug);
      },
      single: true,
      expandSelect: opts.expandSelect,
      renderExpand: opts.renderExpand,
    });
  };

  search.addEventListener("input", () => {
    st.query = search.value;
    draw();
  });
  draw();
}
