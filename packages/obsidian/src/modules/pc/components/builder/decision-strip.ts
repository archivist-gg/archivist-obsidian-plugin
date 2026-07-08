import type { ComponentRenderContext } from "../component.types";
import type { DecisionItem } from "@archivist/dnd5e/pc/pc.decision-engine";
import type { RegisteredEntity } from "@archivist/core";
import { renderSelectionTable } from "./selection-table";
import { DecisionPickModal } from "./decision-modal";
import { humanizeSlug } from "../../../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";
import type { Ability } from "@archivist/dnd5e/types/choice";

/** Render a decision/trait description as a quiet markdown block (smoke r7) at
 *  the top of a top-level live row's nest. Routes through the SHARED markdown
 *  path the compendium blocks use (ctx.app threaded, async) so pipe tables —
 *  e.g. the Elf's "Elven Lineage" lineage table — render as real tables rather
 *  than raw `|...|` text. On failure the `.catch` paints a visible error div so
 *  the pane never silently drops the prose (the Plan-2 error-paint idiom). */
function renderDescBlock(host: HTMLElement, ctx: ComponentRenderContext, markdown: string): void {
  const desc = host.createDiv({ cls: "pc-dstrip-desc" });
  void renderMarkdownDescription(desc, markdown, ctx.app).catch((err: unknown) => {
    console.error("[Archivist] decision description render failed", err);
    desc.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
  });
}

/** Above this many resolved candidates the inline selection table is replaced
 *  by chips + a "Browse all N ▸" ghost that opens the filtered picker modal
 *  (smoke r1 — Fighter Weapon Mastery is choose-3-from-~70). */
const LONG_LIST_THRESHOLD = 12;

/** Canonical toggle semantics shared by every call-site: under the limit
 *  toggle membership; at the limit choose-1 swaps, choose-N refuses. The
 *  caller owns the Set and re-renders after applying. */
export function applyChoiceToggle(selected: Set<string>, value: string, choose: number): void {
  if (selected.has(value)) {
    selected.delete(value);
    return;
  }
  if (selected.size >= choose) {
    if (choose !== 1) return;
    selected.clear();
  }
  selected.add(value);
}

export interface DecisionStripOptions {
  items: DecisionItem[];
  /** Pill text per item: domainPill for race/background, (i) => `L${i.level}` for class. */
  pill: (item: DecisionItem) => string;
  /** false = browse preview — no controls, unresolved rows wear the crimson req dress. */
  live: boolean;
  /** Class scope for setChoice/setSubclass; omit for origin (race/background) writes. */
  classIndex?: number;
  /** Namespace for nested selection-table state in builderUiState. */
  stateKey: string;
}

const PROF_PILL: Record<string, string> = { skill: "Skill", language: "Lang", tool: "Tool" };

/** Short domain label for a decision row's leading pill (race/background scope).
 *  Deterministic over choice kind; the class scope passes its own `L${level}`
 *  pill instead. */
export function domainPill(item: DecisionItem): string {
  const ch = item.choice;
  if (ch.kind === "ability-points") return "Ability";
  if (ch.kind === "select-proficiency") return PROF_PILL[ch.domain] ?? "Pick";
  if (ch.kind === "select-entity") return humanizeToken(ch.entity_type);
  if (ch.kind === "select-inline") {
    const tail = (ch.id ?? "").split("-").filter(Boolean).pop();
    return tail ? humanizeToken(tail) : "Pick";
  }
  return "Pick";
}

const humanizeToken = (t: string): string => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "Pick");

/** SP2 Plan 5 §Amendment: the always-open decision strip. Every actionable row
 *  keeps its control mounted; only the dress tracks state — `open` (unresolved /
 *  partial), `done` (resolved, green ✓ summary), `req` (browse preview, no
 *  controls), `info` (quiet informational row, no choice read). Mutations flow
 *  through ctx.editState; the sheet's onChange re-render rebuilds the ledger. */
export function renderDecisionStrip(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: DecisionStripOptions,
): void {
  const root = parent.createDiv({ cls: "pc-dstrip" });
  for (const item of opts.items) renderRow(root, ctx, item, opts);
}

function renderRow(
  root: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
): void {
  // Informational: no choice to make (`choice` is a never-read sentinel — engine
  // Task 16 contract), so the block is COLLAPSED by default. Click the header to
  // reveal the feature's prose; no chevron, no label (per design) — the header's
  // pointer cursor is the affordance. Without prose, a bare name row.
  if (item.status === "informational") {
    const desc = opts.live ? item.description?.trim() : undefined;
    if (!desc) {
      const row = root.createDiv({ cls: "pc-dstrip-row info" });
      row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
      row.createSpan({ cls: "pc-dstrip-name", text: item.featureName });
      return;
    }
    const bag = ctx.builderUiState;
    const expandKey = `${opts.stateKey}.infoExpanded`;
    const expanded = (bag?.get(expandKey) as Set<string> | undefined) ?? new Set<string>();
    bag?.set(expandKey, expanded);
    const rowKey = `${item.level}.${item.key}`;
    const row = root.createDiv();
    const draw = (): void => {
      row.empty();
      const open = expanded.has(rowKey); // default: absent ⇒ collapsed
      row.className = "pc-dstrip-row info expandable";
      const head = row.createDiv({ cls: "pc-dstrip-head" });
      head.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
      head.createSpan({ cls: "pc-dstrip-name", text: item.featureName });
      head.addEventListener("click", () => {
        if (open) expanded.delete(rowKey); else expanded.add(rowKey);
        draw();
      });
      if (open) renderDescBlock(row.createDiv({ cls: "pc-dstrip-nest" }), ctx, desc);
    };
    draw();
    return;
  }
  const done = item.status === "resolved";
  const state = done ? "done" : opts.live ? "open" : "req";

  // Browse-mode rows (live:false) have no controls/nest → no collapse toggle,
  // and keep the legacy flat header (pill/bang/name/val are direct children).
  if (!opts.live) {
    const row = root.createDiv({ cls: `pc-dstrip-row ${state}` });
    row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
    row.createSpan({ cls: "pc-dstrip-name", text: labelOf(item) });
    row.createSpan({ cls: "pc-dstrip-val", text: statusText(item) });
    return;
  }

  // Live top-level rows are MANUALLY collapsible (SP2 Plan 5, smoke r5).
  // Default = expanded ALWAYS (incl. after resolve — never auto-collapse);
  // collapse is strictly user-initiated and persists in builderUiState. We
  // locally re-render just this row on toggle (chronicle-fold `draw()` idiom)
  // so a click costs only this row, not a full sheet re-render.
  const bag = ctx.builderUiState;
  const collapseKey = `${opts.stateKey}.rowsCollapsed`;
  const collapsed = (bag?.get(collapseKey) as Set<string> | undefined) ?? new Set<string>();
  bag?.set(collapseKey, collapsed);
  const rowKey = `${item.level}.${item.key}`;

  const row = root.createDiv();
  const draw = (): void => {
    row.empty();
    const open = !collapsed.has(rowKey);
    row.className = `pc-dstrip-row ${state}`;
    // Header wrapper carries the click+pointer; the nest below is a SEPARATE
    // flex child, so clicks on chips/steppers/tables never bubble to this
    // toggle. `.pc-dstrip-val` keeps its margin-left:auto inside the head.
    const head = row.createDiv({ cls: "pc-dstrip-head" });
    head.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
    if (!done) head.createSpan({ cls: "pc-dstrip-bang", text: "!" });
    head.createSpan({ cls: "pc-dstrip-name", text: labelOf(item) });
    head.createSpan({ cls: "pc-dstrip-val", text: done ? `✓ ${selectedSummary(item)}` : statusText(item) });
    head.addEventListener("click", () => {
      if (open) collapsed.add(rowKey); else collapsed.delete(rowKey);
      draw();
    });
    if (!open) return;

    const nest = row.createDiv({ cls: "pc-dstrip-nest" });
    // The source feature/trait's own description sits at the TOP of the nest so
    // each live row is self-explanatory (smoke r7). Top-level rows only — a
    // child carries no inherited description; browse rows stay compact (no nest).
    if (item.description?.trim()) renderDescBlock(nest, ctx, item.description.trim());
    renderControl(nest, ctx, item, opts, false);
    // SP2 Plan 5 (Variant II sans pathline): children render as a FLAT group
    // inside the parent's nest — no own borders, no own pills. Each child is a
    // named sub-choice; grandchildren flatten into the same group with a modest
    // extra indent. Only the top-level row keeps the perimeter border + L-pill.
    if (item.children?.length) {
      const group = nest.createDiv({ cls: "pc-dstrip-fgroup" });
      for (const child of item.children) renderChildRow(group, ctx, child, opts, 0);
    }
  };
  draw();
}

/** Variant II flat child: a named sub-choice rendered without its own border or
 *  pill. Resolved children wear the quiet dress (sub-label + ✓ + chips, the
 *  non-selected chips recede); the open/partial child wears the amber tint +
 *  "!" disc so the eye lands on the only open work. Grandchildren flatten into
 *  the same group with a modest extra indent (`depth` drives padding). */
function renderChildRow(
  group: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  depth: number,
): void {
  const done = item.status === "resolved";
  const fc = group.createDiv({ cls: `pc-dstrip-fc ${done ? "quiet" : "partial"}` });
  // Grandchildren indent via padding (not margin) so a partial child's tint
  // panel keeps its -9px left bleed regardless of depth.
  if (depth > 0) fc.style.paddingLeft = `${depth * 14}px`;

  const label = fc.createDiv({ cls: "pc-dstrip-fcl" });
  if (!done) label.createSpan({ cls: "pc-dstrip-fc-flag", text: "!" });
  label.createSpan({ cls: "pc-dstrip-fc-name", text: childLabel(item) });
  if (done) label.createSpan({ cls: "pc-dstrip-fc-ok", text: "✓" });

  // inChild = true: the `.pc-dstrip-fcl` sub-label above already names this
  // sub-choice (via childLabel — carrying the "— choose N" requirement), so the
  // long-list control must NOT re-emit its own `.pc-dstrip-tlabel` header
  // (which is parent-derived from labelOf and would read "FEAT FEAT" / surface
  // the inherited parent featureName). The control suppresses it in child scope.
  renderControl(fc, ctx, item, opts, true);

  // Grandchildren flatten into the SAME group (no nested border), one indent
  // step deeper so the lineage still reads.
  if (item.children?.length) {
    for (const grandchild of item.children) renderChildRow(group, ctx, grandchild, opts, depth + 1);
  }
}

const CHILD_LABEL_MAP: Record<string, string> = {
  feat: "Feat",
  asi: "Ability points",
  "spell-list": "Spell list",
  "spellcasting-ability": "Spellcasting ability",
  skills: "Skills",
};

/** Presentation-layer sub-choice label for a flat child — names the REAL
 *  sub-choice from the child's `choice.id`, never the inherited featureName
 *  (the bug Variant II fixes). Strips a `feat:` key prefix, special-cases the
 *  known ids, else humanizes the slug. When a multi-pick is in progress the
 *  requirement is appended per the mockup's Variant II ("Skills — choose 3 ·
 *  1 picked"); a resolved or single-pick child shows the bare label. */
export function childLabel(item: DecisionItem): string {
  const id = (item.choice.id ?? "").replace(/^feat:/, "");
  const base = CHILD_LABEL_MAP[id] ?? (id ? humanizeSlug(id) : "Choice");
  // ability-points carries a ±-stepper that shows "N point(s) left" itself —
  // its `points` is not a "choose N" count, so never suffix it.
  const need = item.choice.kind === "ability-points" ? 1 : requiredOf(item);
  if (need <= 1) return base;
  const have = selectionCountOf(item);
  return have > 0 && have < need
    ? `${base} — choose ${need} · ${have} picked`
    : `${base} — choose ${need}`;
}

/** Count of picks already made on a child (array length / non-zero allocation
 *  cells / 1 for a set string) — drives the "k picked" requirement suffix. */
function selectionCountOf(item: DecisionItem): number {
  const s = item.selected;
  if (Array.isArray(s)) return s.length;
  if (typeof s === "string") return s ? 1 : 0;
  if (s && typeof s === "object") {
    return Object.values(s as Record<string, number>).reduce((n, v) => n + (v ?? 0), 0);
  }
  return 0;
}

function statusText(item: DecisionItem): string {
  if (item.choice.kind === "ability-points") {
    const spent = Object.values(
      (item.selected as Record<string, number> | undefined) ?? {},
    ).reduce((s, v) => s + (v ?? 0), 0);
    return `${item.choice.points - spent} point(s) left`;
  }
  return `choose ${requiredOf(item)}`;
}

// ── module-private helpers ──────────────────────────────────────────────────

function labelOf(item: DecisionItem): string {
  if (item.choice.kind !== "ability-points" && item.choice.label) return item.choice.label;
  return item.featureName;
}

function selectedSummary(item: DecisionItem): string {
  const s = item.selected;
  if (Array.isArray(s)) {
    return s.map((v) => item.options.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  if (typeof s === "string") return item.options.find((o) => o.value === s)?.label ?? s;
  if (s && typeof s === "object") {
    return Object.entries(s).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ");
  }
  return "";
}

function requiredOf(item: DecisionItem): number {
  const ch = item.choice;
  if (ch.kind === "ability-points") return ch.points;
  if (ch.kind === "select-proficiency") return ch.count;
  return ch.count ?? 1;
}

function selectedSlugs(item: DecisionItem): string[] {
  if (Array.isArray(item.selected)) return item.selected;
  if (typeof item.selected === "string") return [item.selected];
  return [];
}

function writeValue(
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  value: unknown,
): void {
  const es = ctx.editState;
  if (!es) return;
  if (item.choice.kind === "select-entity" && item.choice.entity_type === "subclass") {
    es.setSubclass(opts.classIndex ?? 0, typeof value === "string" ? value : null);
    return;
  }
  if (item.source.kind === "race" || item.source.kind === "background") {
    es.setOriginChoice(`${item.source.kind}:${item.key}`, value);
    return;
  }
  es.setChoice(opts.classIndex ?? 0, item.level, item.key, value);
}

// ── controls ────────────────────────────────────────────────────────────────
// Kind-based dispatch — ability-points and the registry-backed selection table
// short-circuit BEFORE the chips fall-through, so an ability-points item (whose
// value is a Record<ability, number>) can never reach the chips writer (which
// emits a string/array) and corrupt the allocation.

function renderControl(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  inChild: boolean,
): void {
  const ch = item.choice;

  // Ability-points → the always-mounted ±-stepper (Record<ability, number>).
  if (ch.kind === "ability-points") {
    renderAbilityPoints(nest, ctx, item, opts);
    return;
  }

  // Registry-backed entity pick (no explicit `from`) → the shared selection
  // table over the resolved candidate entities.
  if (ch.kind === "select-entity" && !ch.from) {
    const need = requiredOf(item);
    const selected = new Set(selectedSlugs(item));
    // Candidates ride on the options the engine already resolved (each carries
    // its `.entity`); there is no separate registry pass here.
    const candidates = item.options.flatMap((o) => (o.entity ? [o.entity] : []));
    // Top-level only: the parent-derived caps header. In child scope the
    // `.pc-dstrip-fcl` sub-label (childLabel) already precedes this control and
    // carries the requirement, so re-emitting tlabel would duplicate the label
    // and leak the inherited parent featureName ("FEAT FEAT").
    if (!inChild) nest.createDiv({ cls: "pc-dstrip-tlabel", text: `${labelOf(item)} — choose ${need}` });
    // Zero resolved candidates → a quiet line, not the full table chrome.
    if (candidates.length === 0) {
      nest.createDiv({ cls: "pc-dstrip-empty", text: "No options available in your vault yet." });
      return;
    }
    // Long candidate lists (e.g. Fighter Weapon Mastery — choose 3 from ~70)
    // would splat an enormous table into the card. Past the threshold, show the
    // current picks as removable chips + a ghost that opens the filtered picker
    // modal instead. Small lists (a class's handful of subclasses) stay inline.
    if (candidates.length > LONG_LIST_THRESHOLD) {
      renderLongListBrowse(nest, ctx, item, opts, candidates, selected, need);
      return;
    }
    renderSelectionTable(nest, ctx, {
      columns: [],
      candidates,
      stateKey: `${opts.stateKey}.${item.level}.${item.key}`,
      selected,
      single: need === 1,
      onToggle: (slug) => {
        applyChoiceToggle(selected, slug, need);
        writeValue(ctx, item, opts, need === 1 ? ([...selected][0] ?? null) : [...selected]);
      },
    });
    return;
  }

  // Inline / proficiency / explicit-`from` entity picks → the always-open chips
  // row. A `missing` option (slug with no resolved entity) is shown inert:
  // visible with a "(missing)" hint and no click listener, so it can never write
  // a dangling slug. NO `muted` chips at-limit — always-open means clicking
  // another chip in a resolved choose-1 row swaps directly (applyChoiceToggle
  // swaps for choose-1; choose-N still refuses past the cap).
  const need = requiredOf(item);
  const selected = new Set(selectedSlugs(item));
  const chips = nest.createDiv({ cls: "pc-bchoice-chips" });
  for (const o of item.options) {
    const sel = selected.has(o.value);
    const chip = chips.createSpan({
      cls: `pc-bchoice-chip${sel ? " sel" : ""}${o.missing ? " inert" : ""}`,
      text: sel ? `✓ ${o.label}` : o.missing ? `${o.label} (missing)` : o.label,
    });
    // Each option's own prose as a hover tooltip, so the player can preview what an
    // option does before picking it (the data carries it — it was never surfaced).
    if (o.description) chip.setAttribute("title", o.description);
    if (!o.missing) chip.addEventListener("click", () => {
      applyChoiceToggle(selected, o.value, need);
      writeValue(ctx, item, opts, need === 1 ? ([...selected][0] ?? null) : [...selected]);
    });
  }
  // The selected option's prose, shown beneath the chips, so the pick is
  // self-explanatory (e.g. the chosen Combat Mastery's effect).
  for (const o of item.options) {
    if (selected.has(o.value) && o.description?.trim()) renderDescBlock(nest, ctx, o.description.trim());
  }
}

/** Long-list dress for a registry-backed entity pick. Two modes (smoke r4):
 *  - UNRESOLVED (nothing picked) → the prominent dashed ghost `Browse all N ▸`
 *    where the chips would be, inviting the first pick.
 *  - RESOLVED (pick made) → the chosen chip(s) plus a COMPACT inline `Change ▸`
 *    ghost on the SAME line, so any sub-decisions that follow visually attach to
 *    the selection, not the browse button.
 *  Both open the same DecisionPickModal; chip removal and modal writes share the
 *  applyChoiceToggle + writeValue path so the sheet re-render rebuilds the strip. */
function renderLongListBrowse(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  candidates: RegisteredEntity[],
  selected: Set<string>,
  need: number,
): void {
  const write = (): void =>
    writeValue(ctx, item, opts, need === 1 ? ([...selected][0] ?? null) : [...selected]);
  const openModal = (): void => {
    new DecisionPickModal(ctx.app, ctx, {
      title: `${labelOf(item)} — choose ${need}`,
      need,
      candidates,
      initialSelected: [...selected],
      writeValue: (value) => writeValue(ctx, item, opts, need === 1 ? (value[0] ?? null) : value),
      stateKey: `${opts.stateKey}.${item.level}.${item.key}.modal`,
    }).open();
  };

  // Resolved: chips + a compact inline "Change ▸" ghost on the same line.
  if (selected.size) {
    const chips = nest.createDiv({ cls: "pc-bchoice-chips" });
    for (const slug of selected) {
      const label = candidates.find((e) => e.slug === slug)?.name ?? slug;
      const chip = chips.createSpan({ cls: "pc-bchoice-chip sel", text: `✓ ${label}` });
      chip.addEventListener("click", () => {
        applyChoiceToggle(selected, slug, need);
        write();
      });
    }
    const change = chips.createEl("button", { cls: "pc-dstrip-browse compact", text: `Change ▸` });
    change.addEventListener("click", openModal);
    return;
  }

  // Unresolved: the prominent dashed ghost where the chips would be.
  const browse = nest.createEl("button", {
    cls: "pc-dstrip-browse",
    text: `Browse all ${candidates.length} ▸`,
  });
  browse.addEventListener("click", openModal);
}

/** ±-stepper for ability-points: one cell per pool ability, always mounted.
 *  Caps are PICKER-owned (the engine never reflects over-selection or max_per):
 *  + disables at the points-spent cap and the per-ability max_per cap. Writes
 *  the merged allocation through writeValue; clearing the last point writes
 *  null. */
function renderAbilityPoints(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
): void {
  const ch = item.choice;
  if (ch.kind !== "ability-points") return;
  const alloc: Partial<Record<Ability, number>> =
    item.selected && typeof item.selected === "object" && !Array.isArray(item.selected)
      ? { ...item.selected }
      : {};
  const spent = Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0);

  const row = nest.createDiv({ cls: "pc-bpoints" });
  for (const o of item.options) {
    const a = o.value as Ability;
    const cell = row.createDiv({ cls: "pc-bpoints-cell" });
    cell.createSpan({ cls: "pc-bpoints-ab", text: o.label });
    const minus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "−" });
    cell.createSpan({ cls: "pc-bpoints-n", text: String(alloc[a] ?? 0) });
    const plus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "+" });
    plus.disabled = spent >= ch.points || (alloc[a] ?? 0) >= ch.max_per;
    minus.disabled = (alloc[a] ?? 0) <= 0;
    plus.addEventListener("click", () => {
      alloc[a] = (alloc[a] ?? 0) + 1;
      writeValue(ctx, item, opts, alloc);
    });
    minus.addEventListener("click", () => {
      alloc[a] = (alloc[a] ?? 0) - 1;
      if (alloc[a] === 0) delete alloc[a];
      writeValue(ctx, item, opts, Object.keys(alloc).length ? alloc : null);
    });
  }
}

export interface StripInfoRowSpec {
  pill: string;
  name: string;
  value: string;
}

/** A quiet strip-dressed row for fixed grants (no decision). Returns the row
 *  so the caller can attach expansion behavior (e.g. origin-feat block). */
export function renderStripInfoRow(parent: HTMLElement, spec: StripInfoRowSpec): HTMLElement {
  const row = parent.createDiv({ cls: "pc-dstrip-row info" });
  row.createSpan({ cls: "pc-dstrip-pill", text: spec.pill });
  row.createSpan({ cls: "pc-dstrip-name", text: spec.name });
  row.createSpan({ cls: "pc-dstrip-val", text: spec.value });
  return row;
}
