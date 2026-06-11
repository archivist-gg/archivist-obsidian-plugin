import type { ComponentRenderContext } from "../component.types";
import type { DecisionItem } from "../../pc.decision-engine";
import { applyChoiceToggle } from "./choice-callout";

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

// ── ported module-private helpers from decision-ledger.ts ───────────────────

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
// This task covers the chips path only; the ability-points stepper and the
// registry-backed selection table land in Task 3.

function renderControl(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
): void {
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
