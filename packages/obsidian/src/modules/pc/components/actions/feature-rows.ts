import type { ComponentRenderContext } from "../component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes } from "./charge-boxes";
import { renderFeatureCard, formatSourceLabel, sourceBadgeText, featureCardDescription } from "../../blocks/feature-card";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";

/** Reset trigger → the charge-box recovery bucket (moved verbatim from actions-tab.ts). */
const RESET_TO_RECOVERY: Record<string, "dawn" | "short" | "long" | "special"> = {
  "short-rest": "short", "long-rest": "long", "dawn": "dawn", "dusk": "long",
  "turn": "special", "round": "special", "custom": "special",
};

/**
 * One unified feature/passive row:
 *   [cost badge | pc-passive-tag] · [name (+ source sub-label) · right detail · caret]
 * Right detail is the FIRST resource tracker, else the feature's attack note.
 * Extra resources render inside the expand card; when a tracker occupies the
 * single in-row slot the attack note moves to that card too (Finding B). Click
 * (outside the tracker / buff toggle) reveals the shared `.archivist-item-block` card.
 *
 * `merged` (spec §2 / D2-1): same-parent subclass features collapsed onto this
 * class-sourced primary. When present the row shows a joined "Illrigger 3 ·
 * Hellspeaker 3" sub-label, the card body concatenates every feature's prose, and
 * the card gains each secondary's resource trackers + chosen-inline picks.
 */
export function renderFeatureRow(
  list: HTMLElement,
  rf: ResolvedFeature,
  ctx: ComponentRenderContext,
  merged?: ResolvedFeature[],
): void {
  const feature = rf.feature;
  const secondaries = merged ?? [];
  const title = featureRowTitle(rf, ctx.resolved);
  // Sub-label joins the primary source with each merged (subclass) source; for a
  // lone feature this is exactly `formatSourceLabel(rf.source)` (no behavior
  // change). Empty labels are dropped so the " · " separator never dangles.
  const sourceLabel = [rf, ...secondaries]
    .map((r) => formatSourceLabel(r.source))
    .filter(Boolean)
    .join(" · ");

  const row = list.createDiv({ cls: "pc-action-row pc-feature-row" });

  // Badge column — read from the feature's OWN action cost, not the section
  // bucket: a real cost (incl. `free`) → filled cost pill; `special`/absent →
  // outline "Passive" tag. Mirrors the boon-row/item-row badge rule so all
  // four row types share one rule (cost-badge is NOT overloaded with a
  // "special" pill). Keeps the FREE pill distinct inside Passive & Free Actions.
  const badge = row.createDiv({ cls: "pc-feature-badge" });
  const cost = feature.action;
  if (cost && cost !== "special") renderCostBadge(badge, cost);
  else badge.createDiv({ cls: "pc-passive-tag", text: "Passive" });

  // Dim only when the EXACT action cost is action/bonus/reaction (free/special/
  // passive stay live) — one rule across weapons/items/features/boons.
  const ce = ctx.derived.conditionEffects;
  const isAction = cost === "action" || cost === "bonus-action" || cost === "reaction";
  if (ce && isAction && ce.actions_disabled) row.addClass("pc-row-disabled");

  // Name cell — title, source sub-label, and (optionally) the activatable
  // buff toggle. Toggle wiring is carried verbatim from the retired
  // features-table.ts: bound to state.active_buffs by feature id, toggled via
  // editState.toggleActiveBuff, with a static duration label. stopPropagation
  // keeps the toggle click from bubbling into the row-expand handler.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: title });
  if (sourceLabel) nameCell.createDiv({ cls: "pc-action-row-sub", text: sourceLabel });
  if (feature.activatable && feature.id) {
    const buffId = feature.id;
    const buffWrap = nameCell.createDiv({ cls: "pc-action-buff" });
    const active = (ctx.resolved.state.active_buffs ?? []).includes(buffId);
    const label = buffWrap.createEl("label", { cls: "pc-action-buff-control" });
    const cb = label.createEl("input", { cls: "pc-action-buff-toggle", type: "checkbox" });
    cb.checked = active;
    label.createSpan({ cls: "pc-action-buff-text", text: active ? "Active" : "Activate" });
    label.addEventListener("click", (e) => e.stopPropagation());
    cb.addEventListener("change", (e) => {
      e.stopPropagation();
      ctx.editState?.toggleActiveBuff(buffId);
    });
    if (feature.duration && typeof feature.duration === "object") {
      buffWrap.createSpan({ cls: "pc-action-buff-duration", text: `${feature.duration.amount} ${feature.duration.unit}` });
    }
  }

  // Right detail — first resource tracker, else the feature's attack note.
  // Compute the note ONCE: it renders in-row only when no tracker took the
  // single detail slot; when a tracker occupies the slot the note moves to the
  // expand card below (Finding B — the detail is never dropped).
  const detail = row.createDiv({ cls: "pc-feature-detail" });
  const hasTracker = renderFirstResourceTracker(detail, feature, ctx);
  const attackNote = formatFeatureAttackNote(feature, ctx.resolved.totalLevel);
  if (!hasTracker && attackNote) {
    detail.createSpan({ cls: "pc-feature-attack-note", text: attackNote });
  }

  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // Sibling expand card (hidden until the row is clicked) — the shared
  // block card, plus any extra resource trackers (resources[1..N]).
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });
  // Concatenate every feature's `description ?? entries` (blank-line separated)
  // and pass it as an explicit `description` — this OVERRIDES the per-feature
  // `feature` fallback at feature-card.ts:111, so no prose is double-rendered.
  // A lone feature passes `undefined`, keeping the fallback path byte-identical.
  const mergedDescription = secondaries.length
    ? [feature, ...secondaries.map((m) => m.feature)]
        .map((f) => featureCardDescription(f))
        .filter((d): d is string => Boolean(d && d.trim()))
        .join("\n\n") || undefined
    : undefined;
  // Surface each secondary's chosen-inline picks alongside the primary's.
  const mergedChosen = [
    ...(rf.chosenInline ?? []),
    ...secondaries.flatMap((m) => m.chosenInline ?? []),
  ];
  renderFeatureCard(inner, {
    title,
    app: ctx.app,
    sourceLabel,
    sourceBadge: sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition),
    feature,
    description: mergedDescription,
    chosenInline: mergedChosen,
  });
  for (const res of (feature.resources ?? []).slice(1)) renderCardResource(inner, res, ctx);
  // Secondary (merged) features' trackers: the in-row tracker only holds the
  // PRIMARY's first resource, so each secondary's resources surface in the card.
  for (const m of secondaries) {
    for (const res of m.feature.resources ?? []) renderCardResource(inner, res, ctx);
  }
  // Finding B: when a tracker occupied the single in-row detail slot, the
  // feature's attack note lands here in the expand card instead of being lost.
  if (hasTracker && attackNote) {
    inner.createDiv({ cls: "pc-feature-card-attack", text: `Attack: ${attackNote}` });
  }

  row.addEventListener("click", (e) => {
    const t = e.target as HTMLElement | null;
    // Tracker + buff-toggle clicks are handled by their own listeners; never expand.
    if (t?.closest(".pc-feature-track") || t?.closest(".pc-action-buff")) return;
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
}

/** An additional resource tracker (resources[1..N]) rendered inside the card. */
export function renderCardResource(parent: HTMLElement, resource: Resource, ctx: ComponentRenderContext): void {
  const id = resource.id;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  if (!id || !fu) return;
  const line = parent.createDiv({ cls: "pc-card-resource" });
  line.createSpan({ cls: "pc-card-resource-name", text: resource.name });
  if (resource.die) line.createSpan({ cls: "pc-resource-die", text: resolveScalingDie(resource.die, ctx.resolved.totalLevel) });
  const track = line.createSpan({ cls: "pc-feature-track" });
  renderChargeBoxes(track, {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), reset: RESET_TO_RECOVERY[resource.reset] ?? "special" },
    onExpend: () => ctx.editState?.expendFeatureUse(id),
    onRestore: () => ctx.editState?.restoreFeatureUse(id),
  });
}

/**
 * The in-row tracker for the feature's FIRST resource. Bound to
 * `feature_uses[resources[0].id ?? feature.id]`, spent via
 * `editState.expend/restoreFeatureUse` (identical to the retired features-table).
 * Returns true when a tracker was rendered.
 */
function renderFirstResourceTracker(detail: HTMLElement, feature: Feature, ctx: ComponentRenderContext): boolean {
  const res0 = feature.resources?.[0];
  const key = res0?.id ?? feature.id;
  const fu = key ? ctx.resolved.state.feature_uses?.[key] : undefined;
  if (!fu || !key) return false;
  const reset = res0?.reset ?? "long-rest";
  const track = detail.createSpan({ cls: "pc-feature-track" });
  renderChargeBoxes(track, {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), reset: RESET_TO_RECOVERY[reset] ?? "special" },
    onExpend: () => ctx.editState?.expendFeatureUse(key),
    onRestore: () => ctx.editState?.restoreFeatureUse(key),
  });
  return true;
}

/**
 * A feature's in-row attack note ("+7 · d10"). Absorbs the retired
 * `collectFeatureAttacks` logic, including the scaling-die-from-resource
 * fallback: a feature that owns a scaling die surfaces it as the damage for any
 * attack that omits its own static `damage` (static damage always wins; the die
 * is resolved at totalLevel to match the resource tracker). Homebrew authors the
 * loose `{ name?, to_hit?, damage? }` attack shape, read via cast as the old
 * surface did.
 */
function formatFeatureAttackNote(feature: Feature, totalLevel: number): string | undefined {
  const attacks = (feature as unknown as {
    attacks?: Array<{ name?: string; to_hit?: string; damage?: string }>;
  }).attacks;
  if (!attacks?.length) return undefined;
  const dieRes = (feature.resources ?? []).find((r) => r.die);
  const scalingDie = dieRes?.die ? resolveScalingDie(dieRes.die, totalLevel) : undefined;
  const lines: string[] = [];
  for (const a of attacks) {
    const seg: string[] = [];
    if (a.to_hit) seg.push(a.to_hit);
    const dmg = a.damage ?? scalingDie;
    if (dmg) seg.push(dmg);
    lines.push(seg.length ? seg.join(" · ") : (a.name ?? "Attack"));
  }
  return lines.length ? lines.join(" / ") : undefined;
}

/**
 * The row title. Normally `feature.name`, but the entity-named resource synthetic
 * (`pc.resolver.ts` — a `{ name: entityName, resources }` wrapper with no
 * action/description/entries, built identically for class AND subclass
 * entity-level pools) is titled from `resources[0].name` so a Passive row never
 * reads literally "Illrigger" (class) or "Hellspeaker" (subclass).
 */
function featureRowTitle(rf: ResolvedFeature, resolved: ResolvedCharacter): string {
  const f = rf.feature;
  if (isClassResourceSynthetic(rf, resolved)) {
    const resName = f.resources?.[0]?.name;
    if (resName) return resName;
  }
  return f.name;
}

/** Detects the entity-named resource synthetic: a class- or subclass-sourced,
 *  resources-only feature (no action/description/entries) whose name matches one
 *  of the character's class entity names (`source.kind === "class"`) or subclass
 *  entity names (`source.kind === "subclass"`). The dnd5e resolver builds the
 *  identical `{ name, resources }`-only wrapper for both tiers, so both re-title
 *  from `resources[0].name`. */
function isClassResourceSynthetic(rf: ResolvedFeature, resolved: ResolvedCharacter): boolean {
  const f = rf.feature;
  if (rf.source.kind !== "class" && rf.source.kind !== "subclass") return false;
  if (f.action || f.description || (f.entries && f.entries.length > 0)) return false;
  if (!f.resources || f.resources.length === 0) return false;
  return (resolved.classes ?? []).some((c) =>
    rf.source.kind === "subclass" ? c.subclass?.name === f.name : c.entity?.name === f.name);
}
