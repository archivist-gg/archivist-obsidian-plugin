import type { ComponentRenderContext } from "../component.types";
import type { Feature } from "../../../../shared/types/feature";
import type { FeatureSource } from "../../pc.types";
import type { Resource, ResourceDie } from "../../../../shared/types/resource";
import { renderChargeBoxes } from "./charge-boxes";
import { resourceBindings } from "../../pc.resource-seed";
import { evaluateMaxFormula } from "../../../../shared/dnd/resource-formula";
import { createIconProperty, renderTextWithInlineTags } from "../../../../shared/rendering/renderer-utils";

const COUNTER_THRESHOLD = 6;

/** Title-cased reset labels (the row label is CSS-uppercased; the block meta is
 *  shown as-is). */
const RESET_LABEL: Record<string, string> = {
  "short-rest": "Short Rest", "long-rest": "Long Rest", "dawn": "Dawn",
  "dusk": "Dusk", "turn": "Per Turn", "round": "Per Round", "custom": "Special",
};

interface ResourceEntry {
  resource: Resource;
  feature: Feature;
  source: FeatureSource;
}

/** Render the Actions-tab Resources section: a clickable list of pool resources
 *  that are NOT already shown inline in the Features table (dedup rule). Each
 *  row carries its usage tracker; clicking the row expands an inline info block
 *  with the feature's description (and, for recovery pools, the recover action). */
export function renderResourceList(root: HTMLElement, ctx: ComponentRenderContext): void {
  const entries: ResourceEntry[] = [];
  const seen = new Set<string>();
  for (const rf of ctx.resolved.features ?? []) {
    const resources = rf.feature.resources;
    if (!resources?.length) continue;
    const actionable = !!rf.feature.action && rf.feature.action !== "special";
    resources.forEach((r, i) => {
      if (!r.id) return;
      if (actionable && i === 0) return;          // shown inline in the Features table
      if (seen.has(r.id)) return;                 // same id granted at multiple class levels → one row
      seen.add(r.id);
      entries.push({ resource: r, feature: rf.feature, source: rf.source });
    });
  }
  if (entries.length === 0) return;

  root.createEl("h4", { cls: "pc-tab-heading", text: "Resources" });
  const list = root.createDiv({ cls: "pc-resource-list" });
  for (const e of entries) renderResourceRow(list, e, ctx);
}

function renderResourceRow(list: HTMLElement, entry: ResourceEntry, ctx: ComponentRenderContext): void {
  const { resource, feature, source } = entry;
  const id = resource.id;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  if (!id || !fu) return;

  const row = list.createDiv({ cls: "pc-resource-row" });
  row.createSpan({ cls: "pc-resource-row-name", text: resource.name });
  if (resource.die) row.createSpan({ cls: "pc-resource-die", text: currentDie(resource.die, ctx.resolved.totalLevel) });
  row.createSpan({ cls: "pc-reset-inline", text: RESET_LABEL[resource.reset] ?? "Special" });
  row.createSpan({ cls: "pc-row-grow" });

  // Usage tracker — the ONLY place uses are spent. Lives in a `.pc-resource-track`
  // wrapper so the row's expand handler can ignore clicks inside it.
  const track = row.createSpan({ cls: "pc-resource-track" });
  if (fu.max > COUNTER_THRESHOLD) {
    renderCounter(track, id, fu, ctx);
  } else {
    renderChargeBoxes(track, {
      used: fu.used,
      max: fu.max,
      onExpend: () => ctx.editState?.expendFeatureUse(id),
      onRestore: () => ctx.editState?.restoreFeatureUse(id),
    });
  }

  // Sibling expand block (hidden until the row is clicked).
  const expand = list.createDiv({ cls: "pc-resource-expand" });
  expand.hidden = true;
  renderExpandBlock(expand, resource, feature, source, ctx);

  row.addEventListener("click", (e) => {
    // Clicks inside the usage tracker spend uses; they must not toggle the block.
    if ((e.target as HTMLElement)?.closest(".pc-resource-track")) return;
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
  });
}

/**
 * The expanded resource info block — the EXACT same card UI used for spell and
 * item blocks (`.archivist-item-block`: parchment card, drop shadow, crimson
 * header rule, serif title, top-right source badge). The surrounding panel
 * background + hover from the inventory expand is intentionally NOT applied
 * here (see `.pc-resource-expand` in components.css — transparent, no hover);
 * the card stands on the parchment like a floating spell/item block.
 *
 * The block is informational (source · recharge · description). Usage is NEVER
 * repeated here — it lives in the list row. Recovery pools (Arcane Recovery)
 * additionally get their interactive recover ACTION appended inside the card.
 */
function renderExpandBlock(
  expand: HTMLElement,
  resource: Resource,
  feature: Feature,
  source: FeatureSource,
  ctx: ComponentRenderContext,
): void {
  const wrapper = expand.createDiv({ cls: "archivist-item-block-wrapper pc-resource-card" });
  const block = wrapper.createDiv({ cls: "archivist-item-block" });

  // Source badge (top-right) — edition-derived, mirrors spell/item blocks.
  const badge = sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition);
  if (badge) block.createSpan({ cls: "source-badge", text: badge });

  // Header — title + italic source subtitle, with the crimson hairline rule.
  const header = block.createDiv({ cls: "archivist-item-block-header" });
  header.createEl("h3", { cls: "archivist-item-name", text: resource.name });
  const sourceLabel = formatSourceLabel(source);
  if (sourceLabel) header.createDiv({ cls: "archivist-item-subtitle", text: sourceLabel });

  // Properties — recharge cadence (and die, when the pool has one). Same
  // icon-property rhythm as an item block's Weight/Cost lines.
  const props = block.createDiv({ cls: "archivist-item-properties" });
  createIconProperty(props, "rotate-ccw", "Recharge:", RESET_LABEL[resource.reset] ?? "Special");
  if (resource.die) createIconProperty(props, "dices", "Die:", currentDie(resource.die, ctx.resolved.totalLevel));

  // Description (information only).
  if (feature.description) {
    const desc = block.createDiv({ cls: "archivist-item-description" });
    for (const para of feature.description.split(/\n{2,}/)) {
      if (!para.trim()) continue;
      const p = desc.createDiv({ cls: "description-paragraph" });
      renderTextWithInlineTags(para, p);
    }
  }

  // Recovery action (Arcane Recovery) — the only ACTION in the block.
  if (resource.recovery?.length) {
    const fu = resource.id ? ctx.resolved.state.feature_uses?.[resource.id] : undefined;
    renderRecoveryAction(block, resource, source, ctx, fu);
  }
}

/** Edition → friendly source-badge label, matching spell/item block badges. */
function sourceBadgeText(edition: string | undefined): string | null {
  if (edition === "2014") return "SRD 5e";
  if (edition === "2024") return "SRD 2024";
  return null;
}

function renderCounter(track: HTMLElement, id: string, fu: { used: number; max: number }, ctx: ComponentRenderContext): void {
  const wrap = track.createDiv({ cls: "pc-resource-counter" });
  const minus = wrap.createEl("button", { cls: "pc-resource-step pc-resource-step-minus", text: "−", attr: { "aria-label": "Spend one use" } });
  wrap.createSpan({ cls: "pc-resource-counter-val", text: `${fu.max - fu.used}/${fu.max}` });
  const plus = wrap.createEl("button", { cls: "pc-resource-step pc-resource-step-plus", text: "+", attr: { "aria-label": "Restore one use" } });
  // `used` counts spent; the displayed value is remaining. + restores (used−1), − spends (used+1).
  minus.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.setFeatureUse(id, fu.used + 1); });
  plus.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.setFeatureUse(id, fu.used - 1); });
}

/**
 * The recovery action, rendered directly inside the resource's info block (no
 * toggle button). One row per spell level 1..5 that currently has expended
 * slots, each showing one ✗ pip per expended slot. Unticking a pip selects it
 * for recovery (within the level-total budget); over-budget pips are dimmed and
 * not selectable. Recover calls `useRecovery(id, picks)` and is disabled until
 * at least one pip is selected.
 *
 * When the recovery resource's own use is already spent (`fu.used >= fu.max`),
 * the interactive picker is suppressed: we render only the header and a muted
 * hint saying it's used and when it recharges. (Clicking Recover in that state
 * would be a silent no-op, so we don't offer it.)
 */
function renderRecoveryAction(block: HTMLElement, resource: Resource, source: FeatureSource, ctx: ComponentRenderContext, fu?: { used: number; max: number }): void {
  const rec = resource.recovery?.[0];
  const id = resource.id;
  if (!rec || !id) return;

  // The action area always renders so the recover option is visible in the
  // block whatever the slot state — only the body below the header varies.
  const actions = block.createDiv({ cls: "pc-resource-actions" });
  const head = actions.createDiv({ cls: "pc-recover-head" });
  head.createSpan({ cls: "pc-recover-title", text: "Recover spell slots" });

  // Use already spent → show a spent hint instead of an interactive picker.
  if (fu && fu.used >= fu.max) {
    actions.createDiv({ cls: "pc-recover-hint", text: `Already used — recharges on a ${RESET_LABEL[resource.reset] ?? "Special"}.` });
    return;
  }

  let budget = 0;
  try { budget = Math.max(0, Math.floor(evaluateMaxFormula(String(rec.amount), resourceBindings(ctx.resolved, ctx.derived, source)))); } catch { budget = 0; }

  // Expended slots per level (1..5). One ✗ pip per expended slot.
  const levels: { lvl: number; expended: number }[] = [];
  for (let lvl = 1; lvl <= 5; lvl++) {
    const expended = ctx.resolved.state.spell_slots?.[lvl]?.used ?? 0;
    if (expended > 0) levels.push({ lvl, expended });
  }
  // No expended slots → nothing to recover yet, but keep the option visible.
  if (levels.length === 0) {
    actions.createDiv({ cls: "pc-recover-hint", text: "No expended spell slots to recover." });
    return;
  }

  const budgetEl = head.createSpan({ cls: "pc-recover-budget" });
  const budgetVal = budgetEl.createEl("b");
  budgetEl.appendText(" levels left");
  actions.createDiv({ cls: "pc-recover-hint", text: "Untick the expended slots you want back, then Recover." });

  const picks: Record<number, number> = {};
  const pips: { el: HTMLElement; lvl: number }[] = [];
  const ORD: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

  for (const { lvl, expended } of levels) {
    const r = actions.createDiv({ cls: "pc-recover-row" });
    r.createSpan({ cls: "pc-recover-lv", text: ORD[lvl] ?? `${lvl}` });
    const pipWrap = r.createSpan({ cls: "pc-recover-pips", attr: { "data-lv": String(lvl) } });
    for (let k = 0; k < expended; k++) {
      const pip = pipWrap.createEl("button", { cls: "pc-slot-pip pc-slot-pip--spent" });
      pips.push({ el: pip, lvl });
    }
  }

  const foot = actions.createDiv({ cls: "pc-recover-foot" });
  const apply = foot.createEl("button", { cls: "pc-recover-apply", text: "Recover" });
  apply.disabled = true;

  const spent = () => Object.entries(picks).reduce((s, [l, n]) => s + Number(l) * n, 0);
  const selectedCount = () => Object.values(picks).reduce((s, n) => s + n, 0);

  const refresh = () => {
    const remaining = budget - spent();
    budgetVal.setText(String(remaining));
    // Dim spent pips whose level can no longer fit in the remaining budget.
    for (const { el, lvl } of pips) {
      if (el.classList.contains("pc-slot-pip--spent")) {
        el.classList.toggle("pc-slot-pip--over", lvl > remaining);
      }
    }
    apply.disabled = selectedCount() === 0;
  };

  for (const { el, lvl } of pips) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (el.classList.contains("pc-slot-pip--spent")) {
        if (lvl > budget - spent()) return;            // over-budget → not selectable
        el.classList.remove("pc-slot-pip--spent", "pc-slot-pip--over");
        el.classList.add("pc-slot-pip--sel");
        picks[lvl] = (picks[lvl] ?? 0) + 1;
      } else if (el.classList.contains("pc-slot-pip--sel")) {
        el.classList.remove("pc-slot-pip--sel");
        el.classList.add("pc-slot-pip--spent");
        picks[lvl] = Math.max(0, (picks[lvl] ?? 0) - 1);
        if (picks[lvl] === 0) delete picks[lvl];
      }
      refresh();
    });
  }

  apply.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedCount() === 0) return;                 // empty → don't burn the use
    ctx.editState?.useRecovery(id, picks);
  });

  refresh();
}

function formatSourceLabel(source: FeatureSource | undefined): string {
  if (!source) return "";
  switch (source.kind) {
    case "class":
    case "subclass":
      return `${capitalizeSlug(source.slug)} ${source.level}`;
    case "race":
      return capitalizeSlug(source.slug);
    case "background":
      return `Background: ${capitalizeSlug(source.slug)}`;
    case "feat":
      return `Feat: ${capitalizeSlug(source.slug)}`;
    default:
      return "";
  }
}

function capitalizeSlug(slug: string): string {
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
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
