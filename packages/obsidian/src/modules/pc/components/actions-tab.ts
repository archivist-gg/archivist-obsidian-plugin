import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { renderWeaponRow } from "./actions/weapons-table";
import { renderItemRow } from "./actions/items-table";
import { renderBoonRow } from "./actions/boon-rows";
import { buildActionModel, type EconomyKey, type SourceKey } from "./actions/action-model";
import { renderStandardActionsList } from "./actions/standard-actions-list";
import { renderCostBadge, type ActionCost } from "./actions/cost-badge";
import { renderChargeBoxes } from "./actions/charge-boxes";
import { renderFeatureCard, formatSourceLabel, sourceBadgeText } from "../blocks/feature-card";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { CONDITION_DISPLAY_NAMES, type ConditionSlug } from "@archivist-gg/dnd5e/pc/conditions.constants";

const ACTION_DISABLING_CONDITIONS: ReadonlySet<ConditionSlug> = new Set([
  "incapacitated", "paralyzed", "petrified", "stunned", "unconscious",
]);

/** Reset trigger → the charge-box recovery bucket (mirrors the retired
 *  features-table.ts binding so the in-row tracker reads identically). */
const RESET_TO_RECOVERY: Record<string, "dawn" | "short" | "long" | "special"> = {
  "short-rest": "short", "long-rest": "long", "dawn": "dawn", "dusk": "long",
  "turn": "special", "round": "special", "custom": "special",
};

export class ActionsTab implements SheetComponent {
  readonly type = "actions-tab";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-actions-body pc-actions-tab" });

    const ce = ctx.derived.conditionEffects;
    if (ce && ce.actions_disabled) {
      const banner = root.createDiv({ cls: "pc-incapacitated-banner" });
      const names = ce.sources
        .filter((s): s is { condition: ConditionSlug; level?: number; effects: string[] } =>
          s.condition !== "exhaustion" && ACTION_DISABLING_CONDITIONS.has(s.condition))
        .map((s) => CONDITION_DISPLAY_NAMES[s.condition]);
      const status = names.length > 0 ? names.join(" · ") : "Incapacitated";
      banner.createDiv({ cls: "pc-incapacitated-banner-status", text: status });
      banner.createDiv({ cls: "pc-incapacitated-banner-effect", text: "actions & reactions disabled" });
    }

    // ── Two-level economy × source model (spec §3) ───────────────────
    // The pure `buildActionModel` categorizer files every playable entry —
    // weapons, magic items, class/race/background features, feats and boons —
    // into economy sections (Actions / Bonus / Reactions / Passive), each split
    // into fixed-order source sub-groups. The tab is now pure layout: emit the
    // economy heading + each sub-group's head, then dispatch every entry to its
    // row renderer by `entry.kind` (no re-derivation happens here).
    //
    // Per-source grid class — weapons keep the 5-col grid, items the 4-col grid,
    // everything else the feature grid. A fixed `pc-feature-list` for the
    // weapon/item sub-groups would collapse their multi-column grids
    // (actions.css: `.pc-weapons-table`/`.pc-items-table` own the grid), so the
    // list carries the per-source class.
    const LIST_CLASS: Record<SourceKey, string> = {
      weapons: "pc-weapons-table", items: "pc-items-table",
      "class-features": "pc-feature-list", feats: "pc-feature-list",
      race: "pc-feature-list", background: "pc-feature-list", boons: "pc-feature-list pc-boons-list",
    };
    const model = buildActionModel(ctx.resolved, ctx.derived, ctx.services.entities);
    for (const section of model) {
      root.createEl("h4", { cls: "pc-tab-heading", text: section.label });
      for (const sg of section.subGroups) {
        const head = root.createDiv({ cls: "pc-actions-section-head" });
        head.createSpan({ cls: "pc-actions-section-title", text: sg.label });
        if (sg.count) head.createSpan({ cls: "pc-actions-section-count", text: sg.count });
        const list = root.createDiv({ cls: `pc-actions-table ${LIST_CLASS[sg.key]}` });
        for (const e of sg.entries) {
          if (e.kind === "weapon") renderWeaponRow(list, e.attack, ctx);
          else if (e.kind === "item") renderItemRow(list, e.item, ctx);
          else if (e.kind === "boon") renderBoonRow(list, e.entry, e.status, e.poolLabel, ctx);
          else this.renderFeatureRow(list, e.rf, ctx, section.key); // section.key (EconomyKey) is the bucket
        }
      }
    }

    renderStandardActionsList(root, ctx);
  }

  /**
   * One unified feature/passive row:
   *   [cost badge | pc-passive-tag] · [name (+ source sub-label) · right detail · caret]
   * Right detail is the FIRST resource tracker, else the feature's attack note.
   * Extra resources render inside the expand card; when a tracker occupies the
   * single in-row slot the attack note moves to that card too (Finding B). Click
   * (outside the tracker / buff toggle) reveals the shared `.archivist-item-block` card.
   */
  private renderFeatureRow(
    list: HTMLElement,
    rf: ResolvedFeature,
    ctx: ComponentRenderContext,
    bucket: EconomyKey,
  ): void {
    const feature = rf.feature;
    const isPassive = bucket === "passive";
    const title = featureRowTitle(rf, ctx.resolved);
    const sourceLabel = formatSourceLabel(rf.source);

    const row = list.createDiv({ cls: "pc-action-row pc-feature-row" });

    // Badge column — cost badge for action-economy rows, a passive tag otherwise
    // (cost-badge intentionally NOT overloaded with a "special" pill).
    const badge = row.createDiv({ cls: "pc-feature-badge" });
    if (isPassive) badge.createDiv({ cls: "pc-passive-tag", text: "Passive" });
    else renderCostBadge(badge, feature.action as ActionCost);

    // Dim only when the EXACT action cost is action/bonus/reaction (free/special/
    // passive stay live) — one rule across weapons/items/features/boons.
    const ce = ctx.derived.conditionEffects;
    const cost = feature.action;
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
    renderFeatureCard(inner, {
      title,
      sourceLabel,
      sourceBadge: sourceBadgeText((ctx.resolved as { definition?: { edition?: string } }).definition?.edition),
      feature,
      chosenInline: rf.chosenInline,
    });
    for (const res of (feature.resources ?? []).slice(1)) this.renderCardResource(inner, res, ctx);
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
  private renderCardResource(parent: HTMLElement, resource: Resource, ctx: ComponentRenderContext): void {
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
