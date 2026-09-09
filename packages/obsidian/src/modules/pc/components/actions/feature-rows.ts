import type { ComponentRenderContext } from "../component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { renderCostBadge } from "./cost-badge";
import { CHARGE_BOX_LIMIT } from "./charge-boxes";
import { renderResourceTracker } from "./resource-tracker";
import { renderEffectCaptions } from "./effect-captions";
import { renderSpendControl } from "./spend-control";
import { renderFeatureCard, formatSourceLabel, sourceBadgeText, featureCardDescription } from "../../blocks/feature-card";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";
import { renderSeparated } from "../separated-caption";

/**
 * One unified feature/passive row:
 *   [cost badge (empty on the Passive tab)] · [name (+ source sub-label) · right detail · caret]
 * Right detail is the FIRST resource tracker, else the R4-G4 §3.2.5 spend
 * control, else the feature's attack note.
 * Extra resources render inside the expand card; when a tracker or a control
 * occupies the single in-row slot the attack note moves to that card too
 * (Finding B). Click
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
  // lone feature this is exactly `formatSourceLabel(rf.source, ctx.resolved)` (no behavior
  // change). Empty labels are dropped so the separator never dangles. The ARRAY is what the
  // row's own sub-line renders (R4-G6b §10: one `pc-cap-unit` per source, the ` · ` out of flow);
  // the joined string is derived from it for `renderFeatureCard`, whose `sourceLabel` is text.
  const sourceLabels = [rf, ...secondaries]
    .map((r) => formatSourceLabel(r.source, ctx.resolved))
    .filter(Boolean);
  const sourceLabel = sourceLabels.join(" · ");

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
  if (sourceLabels.length) renderSeparated(nameCell.createDiv({ cls: "pc-action-row-sub" }), sourceLabels, { sep: "·" });
  // R4-G3a §4: the caption line for heal / temp-hp / extra-action and for every
  // effect imposed on someone else. It hangs off the NAME cell, not the detail
  // slot: that slot is single-occupancy and the resource tracker wins it on
  // exactly the flagship bearers (Second Wind, Action Surge), which are the rows
  // a caption matters most on. Boon rows do not come through here; since R4-G4 §10
  // `renderBoonRow` makes the same call into its OWN name cell.
  renderEffectCaptions(nameCell, rf.feature.effects ?? [], ctx);
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
    // The line is the label, one plain space and the duration UNIT, whose separator is out of flow
    // and clipped when the unit starts a line: R4-G6b §10 (Q-8). `renderSeparated` writes the space
    // itself (the host already has the label as a child), so the composed `Active · 1 minute` is
    // byte-identical to what the two elements plus an explicit " · " printed before. The unit is a
    // counted English noun and takes an English plural when the amount is not 1 ("10 minutes"),
    // which is copy about a number, not game vocabulary: the four units dnd5e's `durationSchema`
    // admits (round, minute, hour, day) all pluralise regularly, and no branch here reads WHICH unit
    // it is.
    if (feature.duration && typeof feature.duration === "object") {
      const { amount, unit } = feature.duration;
      renderSeparated(buffWrap, [`${amount} ${unit}${amount === 1 ? "" : "s"}`], { sep: "·", leading: true, segCls: "pc-action-buff-duration" });
    }
  }

  // Right detail, in order: first resource tracker, then the spend control, then the feature's
  // attack note. The tracker and the control are INDEPENDENT (the tracker is keyed on
  // `resources`, the control on `consumes`, R4-G4 §3.2.5) and can share the detail, which is how
  // a feature that owns `resources[0]` while spending a FOREIGN id renders both side by side. The
  // note is the one that yields: compute it ONCE and render it in-row only when NEITHER of the
  // other two rendered; when either did, it moves to the expand card below (Finding B: the detail
  // is never dropped).
  const detail = row.createDiv({ cls: "pc-feature-detail" });
  const hasTracker = renderFirstResourceTracker(detail, feature, ctx);
  const consumes = feature.consumes;
  const spendId = consumes?.resource;
  const ownsIt = !!spendId && (feature.resources ?? []).some((r) => r.id === spendId);
  const fu = spendId ? ctx.resolved.state.feature_uses?.[spendId] : undefined;
  // The former `&& fu.max !== AT_WILL_MAX` clause is DROPPED (review M-6). It cannot change the
  // result while `AT_WILL_MAX` (999, dnd5e dnd/resource-formula.ts) is above `CHARGE_BOX_LIMIT`
  // (12, ./charge-boxes.ts): the sentinel already fails `fu.max <= CHARGE_BOX_LIMIT` on its own,
  // and THAT INEQUALITY is the invariant the drop depends on. Were either constant to move so the
  // sentinel fitted under the limit, an at-will resource would read `trackerIsBoxes === true` here
  // and still change nothing, because this flag's ONE consumer is `controlInCard` below, which is
  // independently gated `!isAtWill`. The boxes-versus-"at will" WIDGET choice is
  // `renderChargeBoxes`' own `atWill` opt, never this flag.
  const trackerIsBoxes = !!fu && fu.max <= CHARGE_BOX_LIMIT;
  const isAtWill = !!fu && fu.max === AT_WILL_MAX;
  // Owner-and-spender (R4-G4 §3.2.5) across the THREE tracker widgets `renderChargeBoxes` can
  // pick. BOXES: a click already spends exactly 1, so a feature that owns what it spends renders
  // NO control at `amount === 1` (Rage) and renders it inside the card at `amount > 1`, where no
  // single click spends the right count (Lay on Hands). NUMERIC (`max` above CHARGE_BOX_LIMIT):
  // the card control, at every amount. AT WILL (`max === AT_WILL_MAX`): no control anywhere, because
  // the widget renders the words "at will" and tracks no count for a spend to move. A pure spender
  // (Flurry of Blows), which owns nothing, takes the row slot whatever the owner's widget is.
  const controlInSlot = !!spendId && !ownsIt;
  const controlInCard = !!spendId && ownsIt && !isAtWill && !(consumes.amount === 1 && trackerIsBoxes);
  let hasControl = false;
  if (controlInSlot && consumes) hasControl = renderSpendControl(detail, { consumes, ctx }) !== null;
  const attackNote = formatFeatureAttackNote(feature, ctx);
  if (!hasTracker && !hasControl && attackNote) {
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
  // Recovery: when the PRIMARY feature owns a resource that authors a `recovery` array,
  // feed `opts.recovery` and the card decides the arm from the entry's kind and flavour
  // (R4-G4 §7); `recovery[]` presence is still the only gate here. So a rest-triggered
  // entry reaches `renderRecoveryAction` and renders nothing, by that function's rule, not
  // by a second gate in this file. The scan reads the PRIMARY's `resources` with `rf.source`,
  // the rule this line has always had, so a recovery authored by a merged SECONDARY does not
  // reach the card through it. Regressed v0.2.26: the renderer stayed intact but
  // `opts.recovery` was never populated here.
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
  // The owner-and-spender control (R4-G4 §3.2.5): the row kept its tracker, so the
  // spend lands here beside the card's other resource lines.
  if (controlInCard && consumes) renderSpendControl(inner, { consumes, ctx });
  // Finding B: when a tracker OR a spend control occupied the single in-row detail
  // slot, the feature's attack note lands here in the expand card instead of being
  // lost.
  if ((hasTracker || hasControl) && attackNote) {
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

/** A resource tracker rendered inside the card. `renderFeatureRow` calls it from TWO loops over
 *  its expand card: one over the primary's `(feature.resources ?? []).slice(1)`, and one over every
 *  resource of each merged secondary in `secondaries` · so the call COUNT is the size of those two
 *  sets, not two (review M-10). */
export function renderCardResource(parent: HTMLElement, resource: Resource, ctx: ComponentRenderContext): void {
  const id = resource.id;
  const fu = id ? ctx.resolved.state.feature_uses?.[id] : undefined;
  if (!id || !fu) return;
  const line = parent.createDiv({ cls: "pc-card-resource" });
  line.createSpan({ cls: "pc-card-resource-name", text: resource.name });
  renderResourceTracker(line, ctx, {
    id, name: resource.name, reset: resource.reset,
    die: resource.die, level: resource.die ? resourceLevel(resource.id, ctx) : undefined,
    onExpend: () => ctx.editState?.expendFeatureUse(id),
    onRestore: () => ctx.editState?.restoreFeatureUse(id),
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
  if (!key) return false;
  return renderResourceTracker(detail, ctx, {
    id: key,
    name: res0?.name ?? feature.name,
    reset: res0?.reset ?? "long-rest",
    // R4-G5 §4.3.1, the ONE delta on the class feature row: the owner's die, which this site never
    // read, so a Bard's own Bardic Inspiration row showed boxes and no face while the card and the
    // pool head both printed it. The level is resolved INSIDE the ternary (see ResourceTrackerOpts).
    die: res0?.die,
    level: res0?.die ? resourceLevel(res0.id, ctx) : undefined,
    onExpend: () => ctx.editState?.expendFeatureUse(key),
    onRestore: () => ctx.editState?.restoreFeatureUse(key),
  });
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
