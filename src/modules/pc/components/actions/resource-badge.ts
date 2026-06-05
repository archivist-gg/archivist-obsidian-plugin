import type { ComponentRenderContext } from "../component.types";
import type { FeatureSource } from "../../pc.types";
import type { Resource, ResourceDie } from "../../../../shared/types/resource";
import { renderChargeBoxes } from "./charge-boxes";
import { resourceBindings } from "../../pc.resource-seed";
import { evaluateMaxFormula } from "../../../../shared/dnd/resource-formula";

const COUNTER_THRESHOLD = 6;

const RESET_LABEL: Record<string, string> = {
  "short-rest": "Short rest", "long-rest": "Long rest", "dawn": "Dawn",
  "dusk": "Dusk", "turn": "Per turn", "round": "Per round", "custom": "Special",
};

/** Render the Actions-tab Resources strip: a badge per pool resource that is
 *  NOT already shown inline in the Features table (dedup rule). */
export function renderResourceStrip(root: HTMLElement, ctx: ComponentRenderContext): void {
  const entries: { resource: Resource; source: FeatureSource }[] = [];
  for (const rf of ctx.resolved.features ?? []) {
    const resources = rf.feature.resources;
    if (!resources?.length) continue;
    const actionable = !!rf.feature.action && rf.feature.action !== "special";
    resources.forEach((r, i) => {
      if (!r.id) return;
      if (actionable && i === 0) return;          // shown inline in the Features table
      entries.push({ resource: r, source: rf.source });
    });
  }
  if (entries.length === 0) return;

  root.createEl("h4", { cls: "pc-tab-heading", text: "Resources" });
  const strip = root.createDiv({ cls: "pc-resource-strip" });
  for (const e of entries) renderResourceBadge(strip, e.resource, e.source, ctx);
}

function renderResourceBadge(parent: HTMLElement, resource: Resource, source: FeatureSource, ctx: ComponentRenderContext): void {
  const id = resource.id;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  if (!id || !fu) return;

  const badge = parent.createDiv({ cls: "pc-resource-badge" });
  const head = badge.createDiv({ cls: "pc-resource-badge-head" });
  head.createSpan({ cls: "pc-resource-name", text: resource.name });
  if (resource.die) head.createSpan({ cls: "pc-resource-die", text: currentDie(resource.die, ctx.resolved.totalLevel) });

  if (fu.max > COUNTER_THRESHOLD) {
    renderCounter(badge, id, fu, ctx);
  } else {
    renderChargeBoxes(badge, {
      used: fu.used,
      max: fu.max,
      onExpend: () => ctx.editState?.expendFeatureUse(id),
      onRestore: () => ctx.editState?.restoreFeatureUse(id),
    });
  }

  badge.createDiv({ cls: "pc-resource-reset", text: RESET_LABEL[resource.reset] ?? "Special" });

  if (resource.recovery?.length) renderRecoveryButton(badge, resource, fu, source, ctx);
}

function renderCounter(badge: HTMLElement, id: string, fu: { used: number; max: number }, ctx: ComponentRenderContext): void {
  const wrap = badge.createDiv({ cls: "pc-resource-counter" });
  const minus = wrap.createEl("button", { cls: "pc-resource-step pc-resource-step-minus", text: "−" });
  wrap.createSpan({ cls: "pc-resource-counter-val", text: `${fu.max - fu.used}/${fu.max}` });
  const plus = wrap.createEl("button", { cls: "pc-resource-step pc-resource-step-plus", text: "+" });
  // `used` counts spent; the displayed value is remaining. + restores (used−1), − spends (used+1).
  minus.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.setFeatureUse(id, fu.used + 1); });
  plus.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.setFeatureUse(id, fu.used - 1); });
}

function renderRecoveryButton(badge: HTMLElement, resource: Resource, fu: { used: number; max: number }, source: FeatureSource, ctx: ComponentRenderContext): void {
  const rec = resource.recovery?.[0];
  const id = resource.id;
  if (!rec || !id) return;
  const btn = badge.createEl("button", { cls: "pc-resource-recover-btn", text: rec.name });
  if (fu.used >= fu.max) { btn.disabled = true; return; }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    let amount = 0;
    try { amount = Math.max(0, Math.floor(evaluateMaxFormula(String(rec.amount), resourceBindings(ctx.resolved, ctx.derived, source)))); } catch { amount = 0; }
    openRecoveryPicker(badge, id, amount, ctx);
  });
}

/** Minimal inline slot-restore picker: a stepper per spell level 1..5 that has
 *  a derived slot, capped so the spent level-total stays ≤ `amount`. */
function openRecoveryPicker(badge: HTMLElement, resourceId: string, amount: number, ctx: ComponentRenderContext): void {
  badge.querySelector(".pc-resource-picker")?.remove();
  const picker = badge.createDiv({ cls: "pc-resource-picker" });
  const picks: Record<number, number> = {};
  const levels = Object.entries(ctx.derived.derivedSpellSlots ?? {})
    .filter(([lvl, total]) => Number(lvl) >= 1 && Number(lvl) <= 5 && total > 0)
    .map(([lvl]) => Number(lvl))
    .sort((a, b) => a - b);

  const remaining = picker.createDiv({ cls: "pc-resource-picker-remaining" });
  const spent = () => levels.reduce((s, l) => s + l * (picks[l] ?? 0), 0);
  const refresh = () => { remaining.setText(`Slot levels left: ${amount - spent()}`); };

  for (const lvl of levels) {
    const row = picker.createDiv({ cls: "pc-resource-picker-row" });
    row.createSpan({ text: `L${lvl}` });
    const dec = row.createEl("button", { text: "−" });
    const val = row.createSpan({ cls: "pc-resource-picker-val", text: "0" });
    const inc = row.createEl("button", { text: "+" });
    dec.addEventListener("click", (e) => { e.stopPropagation(); picks[lvl] = Math.max(0, (picks[lvl] ?? 0) - 1); val.setText(String(picks[lvl])); refresh(); });
    inc.addEventListener("click", (e) => {
      e.stopPropagation();
      if (spent() + lvl > amount) return;                 // budget guard
      picks[lvl] = (picks[lvl] ?? 0) + 1; val.setText(String(picks[lvl])); refresh();
    });
  }
  refresh();

  const apply = picker.createEl("button", { cls: "pc-resource-picker-apply", text: "Recover" });
  apply.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.useRecovery(resourceId, picks); });
}

function currentDie(die: ResourceDie, totalLevel: number): string {
  let face = die.base;
  let best = 0;
  for (const [lvl, f] of Object.entries(die.scaling ?? {})) {
    const n = Number(lvl);
    if (n <= totalLevel && n > best) { best = n; face = f; }
  }
  return face;
}
