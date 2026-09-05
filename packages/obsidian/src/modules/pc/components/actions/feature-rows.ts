import type { ComponentRenderContext } from "../component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { renderCostBadge } from "./cost-badge";
import { renderChargeBoxes, CHARGE_BOX_LIMIT } from "./charge-boxes";
import { renderPointPool } from "./point-pool";
import { renderEffectCaptions } from "./effect-captions";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "./reset-labels";
import { renderFeatureCard, formatSourceLabel, sourceBadgeText, featureCardDescription } from "../../blocks/feature-card";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";

/**
 * One unified feature/passive row:
 *   [cost badge (empty on the Passive tab)] · [name (+ source sub-label) · right detail · caret]
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
/** Layout + persistence options threaded from `renderActionSections`. `merged`
 *  is the same-parent subclass collapse (spec §2); `sectionKey` + `entryIdx`
 *  namespace the D1 expand key; `passive` (Task 8, D3) drops the badge column. */
export interface FeatureRowOpts {
  merged?: ResolvedFeature[];
  sectionKey?: string;
  entryIdx?: number;
  passive?: boolean;
}

export function renderFeatureRow(
  list: HTMLElement,
  rf: ResolvedFeature,
  ctx: ComponentRenderContext,
  opts: FeatureRowOpts = {},
): void {
  const feature = rf.feature;
  const secondaries = opts.merged ?? [];
  // D1 expand key: feature identity (source kind+slug + feature.id, falling back
  // to name) plus the section + per-entry index for stability/uniqueness.
  const expandKey = rowExpandKey(
    "feature", opts.sectionKey, rf.source.kind, rf.source.slug,
    feature.id ?? feature.name, opts.entryIdx,
  );
  const title = featureRowTitle(rf, ctx.resolved);
  // Sub-label joins the primary source with each merged (subclass) source; for a
  // lone feature this is exactly `formatSourceLabel(rf.source)` (no behavior
  // change). Empty labels are dropped so the " · " separator never dangles.
  const sourceLabel = [rf, ...secondaries]
    .map((r) => formatSourceLabel(r.source))
    .filter(Boolean)
    .join(" · ");

  const row = list.createDiv({ cls: "pc-action-row pc-feature-row" });

  // The Actions tab keeps the 66px badge column; the Passive tab drops it and
  // renders NO cost pill at all: all passive costs are unmarked (free/special/
  // absent bucket to Passive via featureEconomy).
  const cost = feature.action;
  if (!opts.passive) {
    const badge = row.createDiv({ cls: "pc-feature-badge" });
    if (cost && cost !== "special") renderCostBadge(badge, cost);
  }

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
  // R4-G3a §4: the caption line for heal / temp-hp / extra-action and for every
  // effect imposed on someone else. It hangs off the NAME cell, not the detail
  // slot: that slot is single-occupancy and the resource tracker wins it on
  // exactly the flagship bearers (Second Wind, Action Surge), which are the rows
  // a caption matters most on. Boon rows do not come through here by design.
  renderEffectCaptions(nameCell, rf, ctx);
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
  const attackNote = formatFeatureAttackNote(feature, ctx);
  if (!hasTracker && attackNote) {
    detail.createSpan({ cls: "pc-feature-attack-note", text: attackNote });
  }

  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // Sibling expand card (hidden until the row is clicked) — the shared
  // block card, plus any extra resource trackers (resources[1..N]).
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  const expanded = isRowExpanded(ctx, expandKey);
  expand.hidden = !expanded;
  if (expanded) row.classList.add("open", "pc-row-open");
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
  // Recovery picker (Arcane Recovery): when the PRIMARY feature owns a resource
  // that authors a `recovery` array, feed `opts.recovery` so the card renders the
  // interactive recover-spell-slots picker (`renderRecoveryAction`). Arcane
  // Recovery is a standalone class feature (never a merged secondary), so scanning
  // `feature.resources` with `rf.source` is sufficient. Regressed v0.2.26 — the
  // renderer stayed intact but `opts.recovery` was never populated here.
  const recoveryRes = (feature.resources ?? []).find((r) => r.recovery?.length && r.id);
  renderFeatureCard(inner, {
    title,
    app: ctx.app,
    sourceLabel,
    sourceBadge: sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition),
    feature,
    description: mergedDescription,
    chosenInline: mergedChosen,
    recovery: recoveryRes
      ? { resource: recoveryRes, source: rf.source, ctx, fu: ctx.resolved.state.feature_uses?.[recoveryRes.id] }
      : undefined,
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
    const nowOpen = !expand.hidden;
    row.classList.toggle("open", nowOpen);
    row.classList.toggle("pc-row-open", nowOpen);
    setRowExpanded(ctx, expandKey, nowOpen);
  });
}

/** The level a resource's die and count scale against: the OWNER's class level when the index knows the
 *  owner (R4-G4 §6.2.4), else the total level (a resource with no index entry has no owner; fixtures cast
 *  a ResolvedCharacter without `resources`). */
function resourceLevel(id: string | undefined, ctx: ComponentRenderContext): number {
  const owner = id ? ctx.resolved.resources?.get(id)?.owner : undefined;
  return owner ? resourceLevelFor(owner.source, ctx.resolved) : ctx.resolved.totalLevel;
}

/** A resource tracker rendered inside the card. `renderFeatureRow` calls it twice over its expand
 *  card: once for each of the primary's `(feature.resources ?? []).slice(1)`, and once for every
 *  resource of each merged secondary in `secondaries`. */
export function renderCardResource(parent: HTMLElement, resource: Resource, ctx: ComponentRenderContext): void {
  const id = resource.id;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  if (!id || !fu) return;
  const line = parent.createDiv({ cls: "pc-card-resource" });
  line.createSpan({ cls: "pc-card-resource-name", text: resource.name });
  if (resource.die) line.createSpan({ cls: "pc-resource-die", text: resolveScalingDie(resource.die, resourceLevel(resource.id, ctx)) });
  const track = line.createSpan({ cls: "pc-feature-track" });
  renderChargeBoxes(track, {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), label: RESET_LABELS[resource.reset] },
    recoveryTitle: resource.reset === "custom" ? CUSTOM_RESET_TIP : undefined,
    onExpend: () => ctx.editState?.expendFeatureUse(id),
    onRestore: () => ctx.editState?.restoreFeatureUse(id),
    atWill: fu.max === AT_WILL_MAX,
    limit: CHARGE_BOX_LIMIT,
    renderLarge: (host) => renderPointPool(host, {
      id, name: resource.name, used: fu.used, max: fu.max,
      resetLabel: RESET_LABELS[resource.reset], onSet: (n) => ctx.editState?.setFeatureUse(id, n),
    }),
  });
}

/**
 * The in-row tracker for the feature's FIRST resource. Bound to
 * `feature_uses[resources[0].id ?? feature.id]`, spent via
 * `editState.expend/restoreFeatureUse` (identical to the retired features-table).
 * Returns true when a tracker was rendered.
 *
 * Exported (R4-G3a §11) for the Passive tab's race block, whose trait rows host
 * the same tracker for a COSTLESS trait carrying `resources[]` (R4-G3b §11 gates
 * routed ones out). The case it exists for is the COSTLESS one: those traits never
 * reach a feature row, so before the export their seeded uses had no UI to spend.
 */
export function renderFirstResourceTracker(detail: HTMLElement, feature: Feature, ctx: ComponentRenderContext): boolean {
  const res0 = feature.resources?.[0];
  const key = res0?.id ?? feature.id;
  const fu = key ? ctx.resolved.state.feature_uses?.[key] : undefined;
  if (!fu || !key) return false;
  const reset = res0?.reset ?? "long-rest";
  const track = detail.createSpan({ cls: "pc-feature-track" });
  renderChargeBoxes(track, {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), label: RESET_LABELS[reset] },
    recoveryTitle: reset === "custom" ? CUSTOM_RESET_TIP : undefined,
    onExpend: () => ctx.editState?.expendFeatureUse(key),
    onRestore: () => ctx.editState?.restoreFeatureUse(key),
    atWill: fu.max === AT_WILL_MAX,
    limit: CHARGE_BOX_LIMIT,
    renderLarge: (host) => renderPointPool(host, {
      id: key, name: res0?.name ?? feature.name, used: fu.used, max: fu.max,
      resetLabel: RESET_LABELS[reset], onSet: (n) => ctx.editState?.setFeatureUse(key, n),
    }),
  });
  return true;
}

/**
 * A feature's in-row attack note ("+7 · d10"). Absorbs the retired
 * `collectFeatureAttacks` logic, including the scaling-die-from-resource
 * fallback: a feature that owns a scaling die surfaces it as the damage for any
 * attack that omits its own static `damage` (static damage always wins; the die
 * is resolved at the OWNER's class level through `resourceLevel`, matching the
 * tracker the seed sizes at that level: R4-G4 §6.2.4). Homebrew authors the
 * loose `{ name?, to_hit?, damage? }` attack shape, read via cast as the old
 * surface did.
 */
function formatFeatureAttackNote(feature: Feature, ctx: ComponentRenderContext): string | undefined {
  const attacks = (feature as unknown as {
    attacks?: Array<{ name?: string; to_hit?: string; damage?: string }>;
  }).attacks;
  if (!attacks?.length) return undefined;
  const dieRes = (feature.resources ?? []).find((r) => r.die);
  const scalingDie = dieRes?.die ? resolveScalingDie(dieRes.die, resourceLevel(dieRes.id, ctx)) : undefined;
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
