import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import { renderSourceTag } from "./compendium-filter";
import { renderEntityBlock } from "./entity-block";

export interface ColSpec {
  label: string;
  /** Cell class, e.g. "col-cat". */
  cls: string;
  /** Fixed grid track, e.g. "90px" (the add-drawer's fixed-track approach). */
  width: string;
  /** Comparator; presence makes the header sortable. */
  sort?: (a: RegisteredEntity, b: RegisteredEntity) => number;
  render: (cell: HTMLElement, entity: RegisteredEntity) => void;
}

export interface SelectionTableOptions {
  /** Extra columns between the built-in Name and Source columns. */
  columns: ColSpec[];
  candidates: RegisteredEntity[];
  /** builderUiState key (sort + expanded survive full re-renders). Sort state is
   *  column-index-based: keep the columns array stable for a given key. */
  stateKey: string;
  selected: Set<string>;
  onToggle: (slug: string) => void;
}

interface TableUiState {
  /** "name" or an index into options.columns. */
  sortKey: "name" | number;
  sortDir: "asc" | "desc";
  expanded: Set<string>;
}

const byName = (a: RegisteredEntity, b: RegisteredEntity): number => a.name.localeCompare(b.name);

/** The add-drawer table pattern, generalized: div-grid rows under one fixed
 *  track set, dashed row separators, sortable headers, ＋/✓ selection toggle,
 *  click-row → real entity block expanded inline. Self-redraws rebuild the
 *  whole table (no inputs live here); sort/expand state lives in the lifted
 *  bag so it also survives full sheet re-renders. */
export function renderSelectionTable(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: SelectionTableOptions,
): void {
  const bag = ctx.builderUiState;
  const st: TableUiState =
    (bag?.get(opts.stateKey) as TableUiState | undefined) ??
    { sortKey: "name", sortDir: "asc", expanded: new Set<string>() };
  bag?.set(opts.stateKey, st);

  const host = parent.createDiv({ cls: "pc-btable-host" });
  const tracks = ["30px", "200px", ...opts.columns.map((c) => c.width), "110px"].join(" ");

  const draw = (): void => {
    host.empty();
    if (!opts.candidates.length) {
      host.createDiv({ cls: "pc-btable-empty", text: "No matches." });
      return;
    }
    const list = host.createDiv({ cls: "pc-btable" });

    const head = list.createDiv({ cls: "pc-btable-head" });
    head.style.gridTemplateColumns = tracks;
    const headers: { label: string; key: "name" | number | null; cls: string }[] = [
      { label: "", key: null, cls: "col-add" },
      { label: "Name", key: "name", cls: "col-name" },
      ...opts.columns.map((c, i): { label: string; key: "name" | number | null; cls: string } =>
        ({ label: c.label, key: c.sort ? i : null, cls: c.cls })),
      { label: "Source", key: null, cls: "col-source" },
    ];
    for (const h of headers) {
      const th = head.createDiv({ cls: `pc-btable-th ${h.cls}`, text: h.label });
      if (h.key === null) continue;
      th.classList.add("sortable");
      if (st.sortKey === h.key) th.createSpan({ cls: "pc-btable-sortarr", text: st.sortDir === "asc" ? " ▲" : " ▼" });
      th.addEventListener("click", () => {
        if (st.sortKey === h.key) st.sortDir = st.sortDir === "asc" ? "desc" : "asc";
        else { st.sortKey = h.key!; st.sortDir = "asc"; }
        draw();
      });
    }

    const col = typeof st.sortKey === "number" ? opts.columns[st.sortKey] : undefined;
    const cmp = st.sortKey === "name" ? byName : (col?.sort ?? byName);
    const sorted = [...opts.candidates].sort((a, b) => (st.sortDir === "asc" ? cmp(a, b) : cmp(b, a)));
    for (const e of sorted) renderRow(list, e);
  };

  const renderRow = (list: HTMLElement, e: RegisteredEntity): void => {
    const isSel = opts.selected.has(e.slug);
    const tr = list.createDiv({ cls: "pc-btable-row" });
    tr.style.gridTemplateColumns = tracks;

    const addTd = tr.createDiv({ cls: "col-add" });
    const toggle = addTd.createEl("button", { cls: `pc-btoggle${isSel ? " on" : ""}`, text: isSel ? "✓" : "＋" });
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      opts.onToggle(e.slug);
    });

    const nameTd = tr.createDiv({ cls: "col-name" });
    nameTd.createSpan({ cls: `pc-btable-name${isSel ? " on" : ""}`, text: e.name });
    for (const c of opts.columns) c.render(tr.createDiv({ cls: c.cls }), e);
    renderSourceTag(tr.createDiv({ cls: "col-source" }), e);

    const toggleExpand = (): void => {
      const next = tr.nextElementSibling;
      if (next?.classList.contains("pc-btable-expand-row")) {
        next.remove();
        st.expanded.delete(e.slug);
        tr.classList.remove("pc-row-open");
        return;
      }
      st.expanded.add(e.slug);
      tr.classList.add("pc-row-open");
      const exprow = list.createDiv({ cls: "pc-btable-expand-row" });
      tr.after(exprow);
      const wrap = exprow.createDiv({ cls: "pc-btable-expand" });
      // Pin prose to the visible width when the table out-measures the host.
      const scroller = tr.closest(".pc-btable-host");
      if (scroller) wrap.style.maxWidth = `${(scroller as HTMLElement).clientWidth - 28}px`;
      renderEntityBlock(wrap, e, ctx.core);
    };
    tr.addEventListener("click", toggleExpand);
    if (st.expanded.has(e.slug)) toggleExpand(); // restore open state across redraws
  };

  draw();
}
