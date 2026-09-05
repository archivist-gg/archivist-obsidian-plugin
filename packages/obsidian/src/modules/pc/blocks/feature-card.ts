import type { ComponentRenderContext } from "../components/component.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { FeatureSource } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Resource, ResourceRecovery } from "@archivist-gg/dnd5e/types/resource";
import { resourceBindings } from "@archivist-gg/dnd5e/pc/pc.resource-seed";
import { resolveRecovery } from "@archivist-gg/dnd5e/pc/pc.resources";
import { evaluateMaxFormula } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { type App } from "obsidian";
import { createIconProperty } from "../../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../../shared/rendering/markdown-description";
import { plainText } from "../../../shared/rendering/plain-text";
// R4-G3a §8.2 (3): the reset-label twin that used to live here is retired onto
// the single `ResetTrigger`-keyed table shared with the row trackers.
import { RESET_LABELS, CUSTOM_RESET_TIP } from "../components/actions/reset-labels";
import { renderCostBadge } from "../components/actions/cost-badge";

/**
 * Shared feature/resource block-card renderer.
 *
 * This is the extracted + generalized home for the `.archivist-item-block`
 * parchment card that resources, features, passives, and boons all expand into
 * (crimson header rule, serif title, top-right source badge, icon property-lines,
 * justified description). It was previously trapped as a private, Resource-keyed
 * helper in `components/actions/resource-badge.ts` that rendered `feature.description`
 * ONLY, so `entries`-only features (racial traits, some class features, Invoke
 * Hell) rendered blank. Generalizing here adds the `description ?? entries`
 * fallback and a path for a feature with no resource behind it (no Die line, no
 * recovery action) so the consolidated first-tab rows (Task 3/4/5) can all share
 * ONE card.
 *
 * The properties block is no longer resource-keyed. It renders when there is a Die
 * value (resource-keyed) OR a Save/DC line, and the Save/DC line is read straight
 * off the feature, so a DIE-LESS racial trait such as the SRD Dragonborn's Breath
 * Weapon now carries one (R4-G3a §10.2.2). Die-less, not resource-less: that trait
 * does own a resource (SRD 5e's `dragonborn:breath-weapon`, one use, short rest;
 * the SRD 2024 twin is prof-sized on a long rest) and so gets a tracker on its
 * row; what it has never had is a die, and therefore no properties block at all
 * until the Save line. The `recharge` option that used to sit beside Die had zero
 * producers and was retired with its label twin (R4-G3a §8.2 (3)).
 */

/** A chosen `select-inline` pick surfaced on the parent feature's card. */
export interface FeatureCardChosen {
  label: string;
  description?: string;
}

/** Recovery-action context. Present only for resource-keyed cards whose resource
 *  authors a `recovery`; since R4-G4 §7 that is every recovery carrier, not only the
 *  Wizard's Arcane Recovery, and `renderRecoveryAction` picks the arm from the entry. */
export interface FeatureCardRecovery {
  resource: Resource;
  source: FeatureSource;
  ctx: ComponentRenderContext;
  fu?: { used: number; max: number };
}

export interface FeatureCardOptions {
  /** Card title — `feature.name`, or `resource.name` when resource-keyed. */
  title: string;
  /** Obsidian App: required to render descriptions via the shared markdown path. */
  app: App;
  /** Italic source subtitle (already formatted via {@link formatSourceLabel}). */
  sourceLabel?: string;
  /** Edition source-badge text (top-right); null/undefined → no badge. */
  sourceBadge?: string | null;
  /** Die property-line value (resource-keyed). Omit → no Die line. */
  die?: string;
  /** Explicit description prose; overrides the {@link feature} fallback when set. */
  description?: string;
  /** Source feature. Feeds TWO things: the description falls back to
   *  `description ?? entries` when {@link description} is absent (see
   *  {@link featureCardDescription}), and the Save/DC property line is rendered from
   *  its `save` (or, failing that, its bare `dc_formula`) as authored TEXT. */
  feature?: Feature;
  /** Chosen inline picks → "Chose · <label>: <description>" (or "Chose · <label>"). */
  chosenInline?: FeatureCardChosen[];
  /** Recovery action; present only for resource-keyed cards with a recovery. */
  recovery?: FeatureCardRecovery;
}

/**
 * Resolve a feature's card description, applying the `description ?? entries`
 * fallback (entries joined as blank-line-separated paragraphs). Returns
 * `undefined` when the feature carries neither.
 */
export function featureCardDescription(feature?: Feature): string | undefined {
  if (!feature) return undefined;
  if (feature.description) return feature.description;
  if (feature.entries?.length) return feature.entries.join("\n\n");
  return undefined;
}

/**
 * The shared expand card. Renders (in order): source badge (top-right), header
 * (title + italic source subtitle), the property lines (a Die value when the card is
 * resource-keyed, and/or the feature's Save/DC line; the whole block is omitted when
 * there is neither), the description + any chosen-inline picks, and finally the
 * recovery action (resource-keyed only).
 *
 * The block is informational; usage is NEVER spent here, it lives in the list
 * row's tracker (unchanged rule).
 */
export function renderFeatureCard(parent: HTMLElement, opts: FeatureCardOptions): void {
  const wrapper = parent.createDiv({ cls: "archivist-item-block-wrapper pc-resource-card" });
  const block = wrapper.createDiv({ cls: "archivist-item-block" });

  // Source badge (top-right) — edition-derived, mirrors spell/item blocks.
  if (opts.sourceBadge) block.createSpan({ cls: "source-badge", text: opts.sourceBadge });

  // Header — title + italic source subtitle, with the crimson hairline rule.
  const header = block.createDiv({ cls: "archivist-item-block-header" });
  header.createEl("h3", { cls: "archivist-item-name", text: opts.title });
  if (opts.sourceLabel) header.createDiv({ cls: "archivist-item-subtitle", text: opts.sourceLabel });

  // R4-G3a §10.2.2 · the Save / DC line. `feature.save` is the canonical nested key (the two
  // Dragonborns carry it); a bare `feature.dc_formula` is the prose fallback (208 converter
  // carriers, "your spell save DC" ×56). The formula is ECHOED as authored, through the shared
  // `plainText` stripper, and NEVER evaluated: `{prof_bonus}` is not a `resource-formula` ident, so
  // the SRD Dragonborn's own DC would THROW, and teaching the DSL that spelling fixes 87 of the 208
  // carriers while breaking 121. Rendering the authored text is the whole feature.
  const feature = opts.feature;
  const saveLine = feature?.save
    ? `${feature.save.ability.toUpperCase()} · ${plainText(feature.save.dc_formula)}`
    : feature?.dc_formula ? plainText(feature.dc_formula) : undefined;

  // Properties · the die line, when the pool has one, and the Save/DC line. Same icon-property
  // rhythm as an item block's Weight/Cost lines; a card with neither renders no properties block at
  // all. (The `recharge` option that used to sit here had zero producers and was retired with the
  // label twin, R4-G3a §8.2 (3).)
  if (opts.die || saveLine) {
    const props = block.createDiv({ cls: "archivist-item-properties" });
    if (opts.die) createIconProperty(props, "dices", "Die:", opts.die);
    // The label is narrowed on `saveLine` rather than on `feature.save` so the value stays a
    // `string` for `createIconProperty` (which takes no undefined).
    if (saveLine) createIconProperty(props, "shield", feature?.save ? "Save:" : "DC:", saveLine);
  }

  // Description (information only) — `description ?? entries` — plus any chosen
  // inline picks ("Chose · <label>: <description>") folded onto the card body.
  // Both flow through the SHARED markdown path (ctx.app threaded, async) so a
  // description carrying a pipe table renders a real table instead of raw text.
  // Child divs are created SYNCHRONOUSLY (before firing each async render) so
  // DOM order is stable regardless of async completion order.
  const description = opts.description ?? featureCardDescription(opts.feature);
  const chosen = opts.chosenInline ?? [];
  if ((description && description.trim()) || chosen.length) {
    const desc = block.createDiv({ cls: "archivist-item-description" });
    if (description && description.trim()) {
      const dd = desc.createDiv({ cls: "description-paragraph" });
      void renderMarkdownDescription(dd, description, opts.app).catch((err: unknown) => {
        console.error("[Archivist] feature-card description render failed", err);
        dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
      });
    }
    for (const pick of chosen) {
      const line = pick.description ? `Chose · ${pick.label}: ${pick.description}` : `Chose · ${pick.label}`;
      const pd = desc.createDiv({ cls: "description-paragraph pc-feature-chosen" });
      void renderMarkdownDescription(pd, line, opts.app).catch((err: unknown) => {
        console.error("[Archivist] feature-card chosen render failed", err);
        pd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
      });
    }
  }

  // Recovery action: the only ACTION in the block. Which arm it renders (or none at all)
  // is `renderRecoveryAction`'s decision, from the entry's kind and flavour (R4-G4 §7).
  if (opts.recovery) {
    renderRecoveryAction(block, opts.recovery.resource, opts.recovery.source, opts.recovery.ctx, opts.recovery.fu);
  }
}

/** Edition → friendly source-badge label, matching spell/item block badges. */
export function sourceBadgeText(edition: string | undefined): string | null {
  if (edition === "2014") return "SRD 5e";
  if (edition === "2024") return "SRD 2024";
  return null;
}

/**
 * The recovery action, rendered directly inside the resource's info block (no toggle
 * button), in TWO arms picked from the entry's resolved KIND first and FLAVOUR second
 * (R4-G4 §7.2, invariant 12; `resolveRecovery` in dnd5e's `pc/pc.resources.ts` is the one
 * router, so nothing here matches on the entry's `name`).
 *
 * A `uses` entry of REST flavour renders NOTHING: the rest modal restores it, through the partial
 * category `computeRestPlan` now emits (Rage, Second Wind) OR through the resource's own `reset`
 * when that already fires at the rest, in which case `pushPartialRecoveries`'s guard suppresses the
 * partial so the row is not listed twice (the PHB 2014 Cleric's Channel Divinity, this task's own
 * double-list fixture). A `uses` entry of MANUAL flavour (it carries an `action`, or it resets on
 * `custom`) takes {@link renderUsesRecovery}, the "Regain N" button. A `spell-slots` entry takes
 * the slot picker below whatever its `action` / `reset` say.
 *
 * The picker: one row per spell level 1..5 that currently has expended slots, each showing
 * one ✗ pip per expended slot. Unticking a pip selects it for recovery (within the
 * level-total budget); over-budget pips are dimmed and not selectable. Recover calls
 * `useRecovery(id, picks)` and is disabled until at least one pip is selected. Its header is
 * the entry's own `name`.
 *
 * When the recovery resource's own use is already spent (`fu.used >= fu.max`),
 * the interactive picker is suppressed: we render only the header and a muted
 * hint saying it's used and when it recharges. (Clicking Recover in that state
 * would be a silent no-op, so we don't offer it.)
 */
export function renderRecoveryAction(block: HTMLElement, resource: Resource, source: FeatureSource, ctx: ComponentRenderContext, fu?: { used: number; max: number }): void {
  const rec = resource.recovery?.[0];   // the card reads ONE entry (R4-G4 §7.1); the rest plan walks them all
  const id = resource.id;
  if (!rec || !id) return;
  const { kind, flavour } = resolveRecovery(rec);   // KIND first, FLAVOUR second (invariant 12)
  if (kind === "uses") {
    if (flavour === "rest") return;   // restored by the rest modal (Rage, Second Wind, Channel Divinity, …): nothing to click
    renderUsesRecovery(block, resource, rec, fu, ctx);
    return;
  }

  // kind === "spell-slots": the slot picker, headed by the entry's OWN name. Both shipped
  // carriers, the bundle Wizard's two Arcane Recovery rows (SRD 5e and SRD 2024, measured
  // 2026-09-05), name that entry "Recover spell slots", so the literal that used to live here
  // was an unreachable fallback, and an unreachable fallback is a false document: Gate 0 Q5.
  // The action area always renders so the recover option is visible in the
  // block whatever the slot state — only the body below the header varies.
  const actions = block.createDiv({ cls: "pc-resource-actions" });
  const head = actions.createDiv({ cls: "pc-recover-head" });
  head.createSpan({ cls: "pc-recover-title", text: rec.name });

  // Use already spent → show a spent hint instead of an interactive picker.
  if (fu && fu.used >= fu.max) {
    actions.createDiv({ cls: "pc-recover-hint", text: `Already used · recharges on a ${RESET_LABELS[resource.reset]}.` });
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

/** The manual "Regain N" arm (R4-G4 §7.2.3): one button, the `action` cost badge, the entry's `reset` as a caption
 *  (the ACTION's recharge, no cooldown tracked: G8), disabled at `used === 0`; a `custom` reset is a MANUAL OVERRIDE
 *  the design chooses (Gate 0 I10), and says so.
 *
 *  A PROSE `amount` returns EARLY with that sentence ALONE as the caption, which makes it the one arm that renders
 *  neither the cost badge nor the reset caption. Deliberate, not an oversight (review I-1): every shipped prose amount
 *  is a whole SENTENCE that already names its own trigger, so wrapping it in "Regain <prose> <name> (described in this
 *  feature's text)" read as nonsense on every carrier. Measured 2026-09-05 by walking every `recovery:` block of every
 *  note in the converter corpus AND the bundle: 37 entries, 35 carrying an `amount`, of which THREE are prose (both
 *  "School of Abjuration" notes' Arcane Ward and the 2024 Abjurer's Arcane Ward Hit Points), and NONE of the three
 *  carries an `action`, so the skipped badge drops nothing that ships. */
function renderUsesRecovery(block: HTMLElement, resource: Resource, rec: ResourceRecovery, fu: { used: number; max: number } | undefined, ctx: ComponentRenderContext): void {
  const actions = block.createDiv({ cls: "pc-resource-actions pc-regain-actions" });
  const amount = rec.amount === "all" ? "all" : typeof rec.amount === "number" ? rec.amount : Number(rec.amount);
  if (amount !== "all" && !Number.isFinite(amount)) {
    actions.createDiv({ cls: "pc-regain-note", text: String(rec.amount) });
    return;
  }
  const row = actions.createDiv({ cls: "pc-regain-row" });
  const btn = row.createEl("button", { cls: "pc-regain", text: `Regain ${amount === "all" ? "all" : amount} ${resource.name}` });
  btn.disabled = !fu || fu.used === 0;
  if (rec.action) renderCostBadge(row.createSpan({ cls: "pc-regain-cost" }), rec.action);
  row.createSpan({ cls: "pc-regain-reset", text: RESET_LABELS[rec.reset], attr: rec.reset === "custom" ? { title: CUSTOM_RESET_TIP } : {} });
  if (rec.reset === "custom" && !rec.action) actions.createDiv({ cls: "pc-regain-note", text: "The rules restore this on a condition described in the feature's text; this button is a manual override." });
  btn.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.regainFeatureUses(resource.id, amount); });
}

/** Feature source → italic subtitle label ("Battle Master 3", "Background:
 *  Drifter", …). Relocated here as the surviving copy (the `features-table.ts`
 *  twin dies with that file in Task 5). */
export function formatSourceLabel(source: FeatureSource | undefined): string {
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
  // Recover the bare name from a type-namespaced slug
  // (`<prefix>_<entity_type>_<name>`). slugify never emits `_`, so a slug
  // splits on `_` into exactly 3 parts and the name is `slice(2)`. Arity-robust:
  // also handles a legacy 2-part `<prefix>_<name>` slug and a bare name.
  const p = slug.split("_");
  const bare = p.length >= 3 ? p.slice(2).join("_") : p[p.length - 1];
  return bare.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/**
 * If the feature describes a choice and the character recorded a choice value
 * at this level, append a "Chose: …" line after the description. Otherwise
 * return the raw description. Relocated from the retired `class-block.ts`; still
 * used for chosen-pick summaries on the card.
 */
export function resolveFeatureDescription(feature: Feature, choice: unknown): string {
  const base = feature.description ?? feature.entries?.join(" ") ?? "";
  if (!choice || typeof choice !== "object") return base;
  const parts: string[] = [];
  const c = choice as Record<string, unknown>;
  if (Array.isArray(c.skills) && c.skills.length) parts.push(`Skills: ${(c.skills as string[]).map(prettify).join(", ")}`);
  if (Array.isArray(c.expertise) && c.expertise.length) parts.push(`Expertise: ${(c.expertise as string[]).map(prettify).join(", ")}`);
  if (Array.isArray(c.languages) && c.languages.length) parts.push(`Languages: ${(c.languages as string[]).map(prettify).join(", ")}`);
  if (typeof c.feat === "string") parts.push(`Feat: ${prettify(c.feat.replace(/\[\[|\]\]/g, ""))}`);
  if (typeof c["fighting-style"] === "string") parts.push(`Fighting Style: ${prettify(c["fighting-style"])}`);
  if (parts.length === 0) return base;
  return base ? `${base}\n\nChose: ${parts.join("; ")}` : `Chose: ${parts.join("; ")}`;
}

function prettify(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
