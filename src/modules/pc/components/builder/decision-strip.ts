import type { ComponentRenderContext } from "../component.types";
import type { DecisionItem } from "../../pc.decision-engine";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import { renderSelectionTable } from "./selection-table";
import { DecisionPickModal } from "./decision-modal";
import type { Ability } from "../../../../shared/types/choice";

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
  // Informational: render from featureName only — `choice` is a sentinel and
  // MUST NOT be read (engine Task 16 contract).
  if (item.status === "informational") {
    const row = root.createDiv({ cls: "pc-dstrip-row info" });
    row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
    row.createSpan({ cls: "pc-dstrip-name", text: item.featureName });
    row.createSpan({ cls: "pc-dstrip-val", text: "described in the feature text" });
    return;
  }
  const done = item.status === "resolved";
  const state = done ? "done" : opts.live ? "open" : "req";
  const row = root.createDiv({ cls: `pc-dstrip-row ${state}` });
  row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
  if (!done && opts.live) row.createSpan({ cls: "pc-dstrip-bang", text: "!" });
  row.createSpan({ cls: "pc-dstrip-name", text: labelOf(item) });
  row.createSpan({ cls: "pc-dstrip-val", text: done ? `✓ ${selectedSummary(item)}` : statusText(item) });
  if (opts.live) {
    const nest = row.createDiv({ cls: "pc-dstrip-nest" });
    renderControl(nest, ctx, item, opts);
    if (item.children) for (const child of item.children) renderRow(nest, ctx, child, opts);
  }
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
    nest.createDiv({ cls: "pc-dstrip-tlabel", text: `${labelOf(item)} — choose ${need}` });
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
    if (!o.missing) chip.addEventListener("click", () => {
      applyChoiceToggle(selected, o.value, need);
      writeValue(ctx, item, opts, need === 1 ? ([...selected][0] ?? null) : [...selected]);
    });
  }
}

/** Long-list dress for a registry-backed entity pick: the current picks as
 *  removable sel chips + a compact dashed ghost (the `.pc-bcadd` idiom, never
 *  full-width) that opens the filtered picker modal. Removal and modal toggles
 *  share the same applyChoiceToggle + writeValue path the inline table uses, so
 *  the sheet re-render rebuilds the strip with the new picks. */
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
  }

  const browse = nest.createEl("button", {
    cls: "pc-dstrip-browse",
    text: `Browse all ${candidates.length} ▸`,
  });
  browse.addEventListener("click", () => {
    new DecisionPickModal(ctx.app, ctx, {
      title: `${labelOf(item)} — choose ${need}`,
      need,
      candidates,
      initialSelected: [...selected],
      writeValue: (value) => writeValue(ctx, item, opts, need === 1 ? (value[0] ?? null) : value),
      stateKey: `${opts.stateKey}.${item.level}.${item.key}.modal`,
    }).open();
  });
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
