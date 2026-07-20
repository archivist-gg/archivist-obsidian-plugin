import type { ComponentRenderContext } from "../components/component.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import type { FeatureSource } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Resource } from "@archivist-gg/dnd5e/types/resource";
import { resourceBindings } from "@archivist-gg/dnd5e/pc/pc.resource-seed";
import { evaluateMaxFormula } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { type App } from "obsidian";
import { createIconProperty } from "../../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../../shared/rendering/markdown-description";

/**
 * Shared feature/resource block-card renderer.
 *
 * This is the extracted + generalized home for the `.archivist-item-block`
 * parchment card that resources, features, passives, and boons all expand into
 * (crimson header rule, serif title, top-right source badge, icon property-lines,
 * justified description). It was previously trapped as a private, Resource-keyed
 * helper in `components/actions/resource-badge.ts` that rendered `feature.description`
 * ONLY — so `entries`-only features (racial traits, some class features, Invoke
 * Hell) rendered blank. Generalizing here adds the `description ?? entries`
 * fallback and a resource-less path (no Recharge/Die line, no recovery action)
 * so the consolidated first-tab rows (Task 3/4/5) can all share ONE card.
 */

/** Title-cased reset labels (the row label is CSS-uppercased; the block meta is
 *  shown as-is). */
export const RESET_LABEL: Record<string, string> = {
  "short-rest": "Short Rest", "long-rest": "Long Rest", "dawn": "Dawn",
  "dusk": "Dusk", "turn": "Per Turn", "round": "Per Round", "custom": "Special",
};

/** A chosen `select-inline` pick surfaced on the parent feature's card. */
export interface FeatureCardChosen {
  label: string;
  description?: string;
}

/** Recovery-action context (Arcane Recovery). Present only for resource-keyed
 *  cards whose resource authors a `recovery`. */
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
  /** Recharge-cadence property-line value (resource-keyed). Omit → no Recharge line. */
  recharge?: string;
  /** Die property-line value (resource-keyed). Omit → no Die line. */
  die?: string;
  /** Explicit description prose; overrides the {@link feature} fallback when set. */
  description?: string;
  /** Source feature; description falls back to `description ?? entries` when
   *  {@link description} is absent (see {@link featureCardDescription}). */
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
 * (title + italic source subtitle), property-lines (Recharge/Die — resource-keyed
 * only), the description + any chosen-inline picks, and finally the recovery
 * action (resource-keyed only).
 *
 * The block is informational; usage is NEVER spent here — it lives in the list
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

  // Properties — recharge cadence (and die, when the pool has one). Same
  // icon-property rhythm as an item block's Weight/Cost lines. Resource-keyed
  // cards pass `recharge`; a resource-less feature/passive/boon card has neither.
  if (opts.recharge || opts.die) {
    const props = block.createDiv({ cls: "archivist-item-properties" });
    if (opts.recharge) createIconProperty(props, "rotate-ccw", "Recharge:", opts.recharge);
    if (opts.die) createIconProperty(props, "dices", "Die:", opts.die);
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

  // Recovery action (Arcane Recovery) — the only ACTION in the block.
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
export function renderRecoveryAction(block: HTMLElement, resource: Resource, source: FeatureSource, ctx: ComponentRenderContext, fu?: { used: number; max: number }): void {
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
  // Strip a leading compendium namespace ("mcdm_", "srd-2024_", "srd-5e_", …).
  // The slugify convention removes underscores from names, so the FIRST
  // underscore is always the namespace separator; a bare (no-namespace) slug
  // has no underscore and is left untouched.
  const bare = slug.replace(/^[^_]+_/, "");
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
