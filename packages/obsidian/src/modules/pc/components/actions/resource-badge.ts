import type { ComponentRenderContext } from "../component.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { FeatureSource } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { renderChargeBoxes } from "./charge-boxes";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { RESET_LABEL, renderExpandBlock } from "../../blocks/feature-card";

const COUNTER_THRESHOLD = 6;

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
  if (resource.die) row.createSpan({ cls: "pc-resource-die", text: resolveScalingDie(resource.die, ctx.resolved.totalLevel) });

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

  // Recovery suffix after the tracker, mirroring the item charge style ("/ Long Rest").
  row.createSpan({ cls: "pc-charge-recovery", text: `/ ${RESET_LABEL[resource.reset] ?? "Special"}` });

  // Sibling expand block (hidden until the row is clicked).
  const expand = list.createDiv({ cls: "pc-resource-expand pc-open-expand" });
  expand.hidden = true;
  renderExpandBlock(expand, resource, feature, source, ctx);

  row.addEventListener("click", (e) => {
    // Clicks inside the usage tracker spend uses; they must not toggle the block.
    if ((e.target as HTMLElement)?.closest(".pc-resource-track")) return;
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
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
