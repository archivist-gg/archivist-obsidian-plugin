import type { ComponentRenderContext } from "../component.types";
import type { DecisionItem, DecisionLedger } from "../../pc.decision-engine";
import { renderChoiceCallout, applyChoiceToggle } from "./choice-callout";
import { renderSelectionTable } from "./selection-table";
import type { Ability } from "../../../../shared/types/choice";

export interface DecisionLedgerOptions {
  ledger: DecisionLedger;
  classIndex: number;
  /** Expand/collapse state lives under `${stateKey}.open` in builderUiState. */
  stateKey: string;
}

/** SP2 §7: level-grouped decision rows. Resolved → one-line green-✓ row, click
 *  to reopen; unresolved → open crimson callout with "!"; informational → quiet
 *  description row that renders from featureName only (the choice is a sentinel).
 *  Mutations go through ctx.editState; the sheet's onChange re-render rebuilds the
 *  ledger from a fresh engine pass. */
export function renderDecisionLedger(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: DecisionLedgerOptions,
): void {
  const bag = ctx.builderUiState;
  const openKey = `${opts.stateKey}.open`;
  const open: Set<string> = (bag?.get(openKey) as Set<string> | undefined) ?? new Set<string>();
  bag?.set(openKey, open);

  const root = parent.createDiv({ cls: "pc-bledger" });
  const cls = opts.ledger.classes.find((c) => c.classIndex === opts.classIndex);
  if (!cls || cls.levels.length === 0) {
    root.createDiv({ cls: "pc-bledger-empty", text: "No decisions yet — pick a class." });
    return;
  }
  for (const group of cls.levels) {
    const g = root.createDiv({ cls: "pc-bledger-level" });
    g.createDiv({ cls: "pc-bledger-level-h", text: `Level ${group.level}` });
    for (const item of group.items) renderItem(g, ctx, item, opts, open);
  }
}

function renderItem(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionLedgerOptions,
  open: Set<string>,
): void {
  const itemKey = `${item.level}:${item.key}`;

  // Informational: render from featureName only — `choice` is a sentinel and
  // MUST NOT be read (Task 16 contract).
  if (item.status === "informational") {
    const row = parent.createDiv({ cls: "pc-bledger-info" });
    row.createSpan({ cls: "pc-bledger-info-name", text: item.featureName });
    row.createSpan({ cls: "pc-bledger-info-note", text: "decision described in the feature text" });
    return;
  }

  // Resolved + collapsed: a green-✓ one-liner; click reopens. Children of a
  // resolved select-inline still render below the row.
  if (item.status === "resolved" && !open.has(itemKey)) {
    const row = parent.createDiv({ cls: "pc-bledger-done" });
    row.createSpan({ cls: "pc-bledger-done-check", text: "✓" });
    row.createSpan({ cls: "pc-bledger-done-label", text: labelOf(item) });
    row.createSpan({ cls: "pc-bledger-done-value", text: selectedSummary(item) });
    row.addEventListener("click", () => {
      open.add(itemKey);
      redraw(parent, ctx, opts);
    });
    if (item.children) for (const child of item.children) renderItem(parent, ctx, child, opts, open);
    return;
  }

  // Open: unresolved (crimson `req`), partial, or a reopened resolved item.
  const box = parent.createDiv({ cls: `pc-bledger-item open${item.status === "unresolved" ? " req" : ""}` });
  renderControl(box, ctx, item, opts);
  if (item.children) for (const child of item.children) renderItem(box, ctx, child, opts, open);
}

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

function writeValue(
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionLedgerOptions,
  value: unknown,
): void {
  const es = ctx.editState;
  if (!es) return;
  if (item.choice.kind === "select-entity" && item.choice.entity_type === "subclass") {
    es.setSubclass(opts.classIndex, typeof value === "string" ? value : null);
    return;
  }
  if (item.source.kind === "race" || item.source.kind === "background") {
    es.setOriginChoice(`${item.source.kind}:${item.key}`, value);
    return;
  }
  es.setChoice(opts.classIndex, item.level, item.key, value);
}

function renderControl(
  box: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionLedgerOptions,
): void {
  const ch = item.choice;
  if (ch.kind === "ability-points") {
    renderAbilityPoints(box, ctx, item, opts);
    return;
  }

  // Registry-backed entity pick (no explicit `from`) → the shared selection
  // table over the resolved candidate entities.
  if (ch.kind === "select-entity" && !ch.from) {
    const need = requiredOf(item);
    const selected = new Set(selectedSlugs(item));
    const candidates = item.options.flatMap((o) => (o.entity ? [o.entity] : []));
    box.createDiv({ cls: "pc-bledger-item-h", text: `${labelOf(item)} — choose ${need}` });
    // Zero resolved candidates → a quiet muted-italic empty line, not the full
    // table chrome. The wrapping callout is already borderless, so this reads as
    // a soft N1 note rather than an emphasized "No matches." box.
    if (candidates.length === 0) {
      box.createDiv({ cls: "pc-bledger-empty", text: "No options available in your vault yet." });
      return;
    }
    renderSelectionTable(box, ctx, {
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

  // Inline / proficiency / explicit-`from` entity picks → the N1 callout. A
  // `missing` option (slug with no resolved entity) is shown inert: visible with
  // a "(missing)" hint, but it carries no click listener so it can never write a
  // dangling slug — the onToggle below only ever sees selectable values.
  const need = requiredOf(item);
  const selected = new Set(selectedSlugs(item));
  const callout = box.createDiv();
  renderChoiceCallout(callout, {
    label: labelOf(item),
    choose: need,
    options: item.options.map((o) => ({
      value: o.value,
      label: o.missing ? `${o.label} (missing)` : o.label,
      inert: o.missing,
    })),
    selected,
    required: item.status === "unresolved",
    onToggle: (value) => {
      applyChoiceToggle(selected, value, need);
      writeValue(ctx, item, opts, need === 1 ? ([...selected][0] ?? null) : [...selected]);
    },
  });
}

function selectedSlugs(item: DecisionItem): string[] {
  if (Array.isArray(item.selected)) return item.selected;
  if (typeof item.selected === "string") return [item.selected];
  return [];
}

function renderAbilityPoints(
  box: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionLedgerOptions,
): void {
  const ch = item.choice;
  if (ch.kind !== "ability-points") return;
  const alloc: Partial<Record<Ability, number>> =
    item.selected && typeof item.selected === "object" && !Array.isArray(item.selected)
      ? { ...item.selected }
      : {};
  const spent = Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0);

  const head = box.createDiv({ cls: "pc-bledger-item-h" });
  head.createSpan({ text: `${labelOf(item)} — ` });
  head.createSpan({ cls: "pc-bpoints-left", text: `${ch.points - spent} point(s) left` });

  const row = box.createDiv({ cls: "pc-bpoints" });
  for (const o of item.options) {
    const a = o.value as Ability;
    const cell = row.createDiv({ cls: "pc-bpoints-cell" });
    cell.createSpan({ cls: "pc-bpoints-ab", text: o.label });
    const minus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "−" });
    cell.createSpan({ cls: "pc-bpoints-n", text: String(alloc[a] ?? 0) });
    const plus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "+" });
    // PICKER-owned caps (engine never reflects over-selection or max_per):
    // disable + at the points-spent cap and at the per-ability max_per cap.
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

/** Tear down and rebuild the whole ledger in place (state lives in the lifted
 *  bag, so a fresh pass restores expand/collapse). Used by the resolved-row
 *  reopen click; live builds rebuild via the sheet's onChange instead. */
function redraw(parent: HTMLElement, ctx: ComponentRenderContext, opts: DecisionLedgerOptions): void {
  // `parent` may be a level group or a nested item box; closest() climbs to the
  // ledger root either way, so we re-render under the ledger's own host element.
  const host = parent.closest(".pc-bledger")?.parentElement;
  if (!host) return;
  host.querySelector(".pc-bledger")?.remove();
  renderDecisionLedger(host, ctx, opts);
}
