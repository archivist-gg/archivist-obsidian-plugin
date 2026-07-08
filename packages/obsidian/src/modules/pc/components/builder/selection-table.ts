import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "@archivist/core";
import { renderSourceTag } from "./compendium-filter";
import { renderEntityBlock } from "./entity-block";

export interface ColSpec {
  label: string;
  /** Cell class, e.g. "col-cat". */
  cls: string;
  /** Grid track for the column, normally fixed, e.g. "90px" (any track
   *  expression works). The built-in Name column is the fluid 1fr track. */
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
  /** Single-select dress: the toggle renders as a hollow seal (✓ kept in the
   *  DOM, hidden by CSS until hover/selected) instead of the multi-select ＋.
   *  Swap semantics stay the caller's policy — the component still just
   *  reports clicks via onToggle. */
  single?: boolean;
  /** Race-step semantics (class-step decisions doc): row click = solo-expand =
   *  selected. Drops the toggle column entirely; clicking an unselected row
   *  expands it (collapsing any other) AND fires onToggle. Re-clicking the
   *  selected row toggles its expansion only — it never deselects. Supersedes
   *  `single` when both set. */
  expandSelect?: boolean;
  /** The chosen entity's row is the RESTING default expansion (smoke r6): when
   *  set and no row is currently expanded, this row opens by default, so the
   *  chosen race/background block always shows. The user can still solo-expand
   *  another row (transient swap); re-clicking this row is a no-op (it stays
   *  open, since it's the resting default). expandSelect-only. */
  defaultExpandSlug?: string;
  /** Custom expanded-row content; defaults to the inline entity block. */
  renderExpand?: (wrap: HTMLElement, entity: RegisteredEntity) => void;
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

  // Resting default expansion (smoke r6): when nothing is explicitly expanded,
  // open the chosen entity's row so its block always shows. Other rows can still
  // solo-expand transiently; once they collapse (or on a fresh render) this
  // re-seeds, re-showing the chosen block.
  if (opts.defaultExpandSlug && !st.expanded.size && opts.candidates.some((e) => e.slug === opts.defaultExpandSlug)) {
    st.expanded.add(opts.defaultExpandSlug);
  }

  const host = parent.createDiv({ cls: "pc-btable-host" });
  // The built-in Name column is the single fluid track: data columns keep
  // their fixed widths while Name absorbs the remaining host width, so the
  // ledger fills wide hosts (builder step bodies) and still overflows into
  // the host's horizontal scroll in narrow ones (drawers).
  const tracks = [
    ...(opts.expandSelect ? [] : ["30px"]),
    "minmax(200px, 1fr)",
    ...opts.columns.map((c) => c.width),
    "110px",
  ].join(" ");

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
      ...(opts.expandSelect ? [] : [{ label: "", key: null, cls: "col-add" }]),
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

    if (!opts.expandSelect) {
      const addTd = tr.createDiv({ cls: "col-add" });
      const toggle = opts.single
        ? addTd.createEl("button", {
            cls: `pc-btoggle seal${isSel ? " on" : ""}`,
            text: "✓",
            attr: { title: isSel ? "Current" : "Select" },
          })
        : addTd.createEl("button", { cls: `pc-btoggle${isSel ? " on" : ""}`, text: isSel ? "✓" : "＋" });
      toggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        opts.onToggle(e.slug);
      });
    }

    const nameTd = tr.createDiv({ cls: "col-name" });
    nameTd.createSpan({ cls: `pc-btable-name${isSel ? " on" : ""}`, text: e.name });
    if (opts.expandSelect && isSel) nameTd.createSpan({ cls: "pc-bname-seal", text: " ✓" });
    for (const c of opts.columns) c.render(tr.createDiv({ cls: c.cls }), e);
    renderSourceTag(tr.createDiv({ cls: "col-source" }), e);

    const toggleExpand = (fromClick: boolean): void => {
      const next = tr.nextElementSibling;
      if (next?.classList.contains("pc-btable-expand-row")) {
        // The resting-default row (chosen race/background) never collapses on
        // re-click — it's always-shown (smoke r6), so the gesture is a no-op.
        if (fromClick && opts.defaultExpandSlug === e.slug) return;
        next.remove();
        st.expanded.delete(e.slug);
        tr.classList.remove("pc-row-open");
        return;
      }
      if (opts.expandSelect) {
        // Solo-expand: at most one open row in this mode.
        list.querySelectorAll(".pc-btable-expand-row").forEach((n) => n.remove());
        list.querySelectorAll(".pc-row-open").forEach((n) => n.classList.remove("pc-row-open"));
        st.expanded.clear();
      }
      st.expanded.add(e.slug);
      tr.classList.add("pc-row-open");
      const exprow = list.createDiv({ cls: "pc-btable-expand-row" });
      tr.after(exprow);
      const wrap = exprow.createDiv({ cls: "pc-btable-expand" });
      // Pin prose to the visible width when the table out-measures the host.
      //
      // The host's clientWidth is read live. But on Obsidian's first open with
      // this tab already active, the leaf is restored DEFERRED — the view tree
      // is built before the workspace lays it out, so clientWidth reads 0 and
      // the pin clamps the block to a sliver (`max-width: -28px` → ~0). The user
      // saw this as the chronicle block rendering ~45% wide ONLY on first open;
      // switching steps re-renders once the view is sized, so it looked fine.
      // (The class card escapes this — it is not hosted in an expand cell.)
      //
      // Root fix: re-measure when the host GAINS size. A ResizeObserver on the
      // host re-applies the pin on every size change, so the deferred 0-width
      // first paint self-corrects the instant the workspace lays the leaf out —
      // no re-render needed. The observer disconnects when this expand row is
      // removed (collapse / redraw), so it never leaks.
      const scroller = tr.closest<HTMLElement>(".pc-btable-host");
      if (scroller) {
        const applyMax = (): void => {
          const w = scroller.clientWidth;
          // Only pin once the host has a real measured width; a 0/near-0 read
          // (deferred paint) leaves max-width unset so the block fills naturally
          // until the observer fires with the laid-out width.
          if (w > 28) wrap.style.maxWidth = `${w - 28}px`;
          else wrap.style.removeProperty("max-width");
        };
        applyMax();
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(applyMax);
          ro.observe(scroller);
          // Tear down when the expand row leaves the DOM (collapse/redraw): a
          // MutationObserver on the list watches for exprow's removal, then
          // disconnects both observers.
          const mo = new MutationObserver(() => {
            if (!exprow.isConnected) { ro.disconnect(); mo.disconnect(); }
          });
          mo.observe(list, { childList: true });
        }
      }
      if (opts.renderExpand) opts.renderExpand(wrap, e);
      else renderEntityBlock(wrap, e);
      // Selection rides the user's expand gesture — never the redraw-restore path.
      if (fromClick && opts.expandSelect && !opts.selected.has(e.slug)) opts.onToggle(e.slug);
    };
    tr.addEventListener("click", () => toggleExpand(true));
    if (st.expanded.has(e.slug)) toggleExpand(false); // restore open state across redraws
  };

  draw();
}
