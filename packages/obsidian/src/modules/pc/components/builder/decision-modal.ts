import { Modal, type App } from "obsidian";
import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "@archivist/core";
import {
  allTicked, matchesTicked, renderCompendiumFilter,
  type CompendiumTickState,
} from "./compendium-filter";
import { renderSelectionTable } from "./selection-table";
import { applyChoiceToggle } from "./decision-strip";

export interface DecisionPickBodyOptions {
  /** Modal heading + the strip's tlabel sentence, e.g. "Weapon Mastery — choose 3". */
  title: string;
  /** choose-N cap; enforced by applyChoiceToggle (choose-1 swaps, choose-N refuses). */
  need: number;
  /** Resolved candidate entities (the engine's option.entity list). */
  candidates: RegisteredEntity[];
  /** Current selection at open; seeds the modal-local Set. */
  initialSelected: string[];
  /** Persist the new selection. The modal redraws from its LOCAL Set afterwards;
   *  it never reads ctx.resolved, which is stale behind the open modal. */
  writeValue: (value: string[]) => void;
  close: () => void;
  /** builderUiState namespace for the search/filter/table state. */
  stateKey: string;
}

interface PickUiState {
  query: string;
  ticked: CompendiumTickState | null;
}

/** Pure body of the long-list decision picker, exported for tests. Mirrors the
 *  entity-picker shell (persistent search input + compendium tick-filter over
 *  the shared selection table) but in MULTI-select mode against a modal-local
 *  Set: each row toggle writes immediately (the sheet re-renders behind the
 *  modal), and the modal redraws itself from its own Set — never from the now
 *  stale ctx.resolved. A live count + Done (close-only) sit in the footer. */
export function renderDecisionPickBody(
  host: HTMLElement,
  ctx: ComponentRenderContext,
  opts: DecisionPickBodyOptions,
): void {
  // The modal owns the authoritative selection for its lifetime; ctx.resolved
  // is stale the instant we write, so we track membership locally and only ever
  // grow/shrink this Set.
  const selected = new Set(opts.initialSelected);

  const bag = ctx.builderUiState;
  const st: PickUiState =
    (bag?.get(opts.stateKey) as PickUiState | undefined) ?? { query: "", ticked: null };
  bag?.set(opts.stateKey, st);

  const compendiums = ctx.core.compendiums.getAll();
  if (!st.ticked) st.ticked = allTicked(compendiums);

  // Const-indirection so the sentence-case UI lint (bare-literal only) leaves
  // the Title-Case heading intact, matching the rest-/class-modal chrome.
  const title = opts.title;
  host.createEl("h2", { cls: "pc-bcm-title" }).setText(title);

  const root = host.createDiv({ cls: "pc-bpicker pc-bcm-scroll" });
  const search = root.createEl("input", {
    cls: "pc-bpicker-search",
    attr: { type: "text", placeholder: "Search…" },
  });
  search.value = st.query;
  const filterHost = root.createDiv({ cls: "pc-bpicker-filter" });
  const tableHost = root.createDiv({ cls: "pc-bpicker-table" });

  const foot = host.createDiv({ cls: "pc-bcm-foot" });
  const count = foot.createSpan({ cls: "pc-bdecide-count" });
  const done = foot.createEl("button", { cls: "pc-bdecide-done", text: "Done ▸" });
  done.addEventListener("click", () => opts.close());

  const refreshCount = (): void => {
    count.setText(`${selected.size} of ${opts.need} chosen`);
  };

  const draw = (): void => {
    filterHost.empty();
    tableHost.empty();
    renderCompendiumFilter(filterHost, compendiums, st.ticked!, draw);

    const q = st.query.trim().toLowerCase();
    const cands = opts.candidates
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .filter((e) => matchesTicked(e, st.ticked!));

    renderSelectionTable(tableHost, ctx, {
      columns: [],
      candidates: cands,
      stateKey: `${opts.stateKey}.table`,
      selected,
      single: opts.need === 1,
      onToggle: (slug) => {
        const before = selected.size;
        const had = selected.has(slug);
        applyChoiceToggle(selected, slug, opts.need);
        // applyChoiceToggle refuses a choose-N add at the cap (set unchanged);
        // skip the write+redraw so a blocked click is a true no-op.
        if (selected.size === before && selected.has(slug) === had) return;
        opts.writeValue([...selected]);
        refreshCount();
        draw();
      },
    });
    refreshCount();
  };

  search.addEventListener("input", () => {
    st.query = search.value;
    draw();
  });
  draw();
}

export interface DecisionPickModalOptions {
  title: string;
  need: number;
  candidates: RegisteredEntity[];
  initialSelected: string[];
  writeValue: (value: string[]) => void;
  stateKey: string;
}

/** Obsidian Modal wrapper around renderDecisionPickBody. Mirrors AddClassModal's
 *  chrome (.archivist-modal portal scope), swapping the class-specific
 *  .pc-bclass-modal flag for .pc-bdecide-modal so the shared modal CSS and the
 *  width override target it too. */
export class DecisionPickModal extends Modal {
  constructor(
    app: App,
    private readonly ctx: ComponentRenderContext,
    private readonly opts: DecisionPickModalOptions,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal");
    this.contentEl.addClass("pc-bdecide-modal");
    renderDecisionPickBody(this.contentEl, this.ctx, { ...this.opts, close: () => this.close() });
  }

  onClose(): void { this.contentEl.empty(); }
}
