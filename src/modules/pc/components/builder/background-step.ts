import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import type { DecisionItem } from "../../pc.decision-engine";
import type { BackgroundLanguageProficiency } from "../../../background/background.types";
import { renderEntityPicker } from "./entity-picker";
import { renderCustomBackgroundRow } from "./custom-background";
import { renderEntityBlock } from "./entity-block";
import { buildDecisionLedger, wikilinkTailSlug } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";
import { humanizeSlug } from "../../../../shared/rendering/renderer-utils";
import { renderChronicleBlock, renderSectionRule } from "./chronicle-block";
import { renderDecisionStrip, renderStripInfoRow, domainPill } from "./decision-strip";

const skillsOf = (e: RegisteredEntity): string[] =>
  (e.data as { skill_proficiencies?: string[] }).skill_proficiencies ?? [];

const BG_COLUMNS: ColSpec[] = [
  {
    label: "Skills", cls: "col-skills", width: "180px",
    render: (cell, e) => {
      const s = skillsOf(e).map(humanizeSlug);
      cell.setText(s.length ? s.join(", ") : "—");
    },
  },
];

/** Structural cast of a background entity's `data`, covering both editions. */
interface BackgroundData {
  name?: string;
  edition?: string;
  source?: string;
  description?: string;
  skill_proficiencies?: string[];
  tool_proficiencies?: Array<{ kind: string; items?: string[] }>;
  language_proficiencies?: BackgroundLanguageProficiency[];
  equipment?: Array<{ item: string; quantity?: number } | { kind: "currency"; gp: number }>;
  feature?: { name: string; description?: string };
  ability_score_increases?: { pool?: string[] } | null;
  origin_feat?: string | null;
  choices?: Array<{ kind: string; count?: number; points?: number; max_per?: number; pool?: string[] }>;
}

const stripSummary = (items: DecisionItem[]): string => {
  const done = items.filter((i) => i.status === "resolved").length;
  return `${items.length} total · ${done} resolved · ${items.length - done} open`;
};

const NO_DESC = "(No description provided.)";

/** SP2 §1 (Plan 5) — Background step. The chosen background's expanded row
 *  composes ONE Chronicle block: the edition-mix warm note (`pre:`, above the
 *  identity band) + glance tiles (edition-specific) + an always-open decision
 *  strip under a "What you decide" rule (origin items + the fixed origin-feat
 *  info row) + a "Proficiencies & starting gear" section. Every other expanded
 *  row renders the same block WITHOUT the strip + origin-feat row. */
export function renderBackgroundStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  // The pinned ✦ Custom Background entry sits ABOVE the picker table: it opens a
  // parts builder that writes a real homebrew BackgroundEntity and selects it.
  renderCustomBackgroundRow(body, ctx);
  renderEntityPicker(body, ctx, {
    entityType: "background",
    stateKey: "builder.background-picker",
    selectedSlug: stripSlug(ctx.resolved.definition.background),
    onSelect: (slug) => ctx.editState?.setBackground(slug),
    columns: BG_COLUMNS,
    expandSelect: true,
    // The chosen background's block always shows (smoke r6): its row is the
    // resting default expansion.
    defaultExpandSlug: stripSlug(ctx.resolved.definition.background) ?? undefined,
    renderExpand: (wrap, e) => {
      // The strip + origin-feat row belong to the STANDING pick only — a freshly-
      // clicked row becomes the pick via onSelect, and the onChange re-render
      // composes them on the restore pass (by then it IS the chosen background).
      const chosen = e.slug === stripSlug(ctx.resolved.definition.background);
      const d = e.data as BackgroundData;
      const ledger = chosen ? buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities }) : null;
      const items = ledger?.origin.filter((i) => i.source.kind === "background") ?? [];
      const ofeat = chosen ? resolveOriginFeat(ctx, e) : null;
      renderChronicleBlock(wrap, {
        name: e.name,
        sub: backgroundSub(d),
        badge: `${d.source ?? ""} · ${d.edition ?? ""}`.replace(/^ · | · $/g, ""),
        flavor: (d.description ?? "").trim() || undefined,
        pre: chosen ? (host) => renderEditionMixBanner(host, ctx, e) : undefined,
        tiles: backgroundTiles(d),
        body: (host) => {
          if (chosen && (items.length || ofeat)) {
            renderSectionRule(host, "What you decide", stripSummary(items));
            renderDecisionStrip(host, ctx, { items, pill: domainPill, live: true, stateKey: "builder.background-strip" });
            // Append the fixed origin-feat row into the SAME strip root so it sits
            // beside the decision rows; the feat block expands as its sibling.
            const strip = host.querySelector<HTMLElement>(".pc-dstrip") ?? host.createDiv({ cls: "pc-dstrip" });
            renderOriginFeatStripRow(strip, ctx, e);
          }
          renderGearProps(host, d);
        },
      });
    },
  });
}

/** Sub-line: `Background · <skills joined " & "> · <tool>` — segments only when
 *  present (the tool segment is the fixed tool name, omitted when none). */
function backgroundSub(d: BackgroundData): string {
  const skills = (d.skill_proficiencies ?? []).map(humanizeSlug).join(" & ");
  return ["Background", skills, fixedToolNames(d)].filter(Boolean).join(" · ");
}

/** Edition-specific glance tiles. 2024: Skills / Tool / Ability Points / Origin
 *  Feat. 2014: Skills / Tool (when present) / Languages / Feature. */
function backgroundTiles(d: BackgroundData): Array<{ label: string; value: string; small?: string }> {
  const skills = (d.skill_proficiencies ?? []).map(humanizeSlug).join(", ");
  const tool = fixedToolNames(d);
  const is2024 = !!d.ability_score_increases || (d.choices ?? []).some((c) => c.kind === "ability-points");
  if (is2024) {
    return [
      ...(skills ? [{ label: "Skills", value: skills }] : []),
      ...(tool ? [{ label: "Tool", value: tool }] : []),
      ...abilityPointsTile(d),
      ...originFeatTile(d),
    ];
  }
  const lang = languagesTile(d);
  const feat = d.feature?.name;
  return [
    ...(skills ? [{ label: "Skills", value: skills }] : []),
    ...(tool ? [{ label: "Tool", value: tool }] : []),
    ...(lang ? [{ label: "Languages", value: lang }] : []),
    ...(feat ? [{ label: "Feature", value: feat }] : []),
  ];
}

/** 2024 Ability Points tile: `+<points>` with the pool caps + ` max +<max_per>`. */
function abilityPointsTile(d: BackgroundData): Array<{ label: string; value: string; small?: string }> {
  const ap = (d.choices ?? []).find((c) => c.kind === "ability-points");
  if (!ap) return [];
  const pools = (ap.pool ?? []).map((p) => p.toUpperCase()).join(" · ");
  return [{ label: "Ability Points", value: `+${ap.points ?? 0}`, small: `${pools} max +${ap.max_per ?? 0}` }];
}

/** 2024 Origin Feat tile: the resolved display name. */
function originFeatTile(d: BackgroundData): Array<{ label: string; value: string }> {
  if (!d.origin_feat) return [];
  return [{ label: "Origin Feat", value: originFeatDisplayName(d.origin_feat) }];
}

/** 2014 Languages tile: prefers the fixed-entry language names, else the choice
 *  entry → `choose <n>`. */
function languagesTile(d: BackgroundData): string {
  const fixed = fixedLanguageNames(d);
  if (fixed) return fixed;
  const choice = (d.language_proficiencies ?? []).find(
    (l): l is Extract<BackgroundLanguageProficiency, { kind: "choice" }> => l.kind === "choice",
  );
  if (choice) return `choose ${choice.count ?? 1}`;
  return "";
}

/** Fixed tool name(s) humanized — only `kind:"fixed"` entries carrying items. */
function fixedToolNames(d: BackgroundData): string {
  const names = (d.tool_proficiencies ?? [])
    .filter((t) => t.kind === "fixed")
    .flatMap((t) => (t.items ?? []).map(humanizeSlug));
  return names.join(", ");
}

/** Fixed language names humanized — only `kind:"fixed"` entries' `languages`
 *  arrays (flattened); choice entries are skipped. */
function fixedLanguageNames(d: BackgroundData): string {
  const names = (d.language_proficiencies ?? [])
    .filter((l): l is Extract<BackgroundLanguageProficiency, { kind: "fixed" }> => l.kind === "fixed")
    .flatMap((l) => l.languages.map(humanizeSlug));
  return names.join(", ");
}

/** §6: the one mechanical edition-mix conflict — a species that grants ability
 *  increases combined with a 2024-style background pool. Permissive: an amber
 *  note, never a block. Fires only when BOTH the background carries an ASI pool
 *  and the species grants ability increases (fixed or a choice). Ported body —
 *  now rendered INSIDE the block, above the identity band. */
function renderEditionMixBanner(wrap: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const bgPool = (e.data as { ability_score_increases?: { pool?: unknown[] } | null }).ability_score_increases;
  if (!bgPool) return;
  const race = ctx.resolved.race as unknown as {
    name?: string;
    ability_score_increases?: unknown[];
    choices?: Array<{ kind: string }>;
  } | null;
  const raceGrants =
    (race?.ability_score_increases?.length ?? 0) > 0 ||
    (race?.choices ?? []).some((c) => c.kind === "ability-points");
  if (!raceGrants) return;
  const warn = wrap.createDiv({ cls: "pc-bwarn" });
  warn.createSpan({ cls: "pc-bwarn-c", text: "!" });
  warn.createSpan({
    cls: "pc-bwarn-t",
    text:
      `Your species ${race?.name ?? ""} already grants ability increases, and this background grants them too — ` +
      `more than a standard character. Keep both if your table allows it, or pick a matching-edition background.`,
  });
}

/** The resolved origin-feat lookup, shared by the tile (display only) and the
 *  strip row (display + the expandable feat block). Returns null when the
 *  background carries no `origin_feat` ref. `display` = variant name ?? feat
 *  name ?? bare slug; `feat` is undefined when the ref doesn't resolve. */
function resolveOriginFeat(
  ctx: ComponentRenderContext,
  e: RegisteredEntity,
): { feat: RegisteredEntity | undefined; display: string } | null {
  const ref = (e.data as { origin_feat?: string | null }).origin_feat;
  if (!ref) return null;
  // Canonical 2024 backgrounds carry PATH-style wikilinks, e.g.
  // "[[SRD 2024/Feats/Alert]]" — the tail segment slugified is the bare feat slug
  // ("alert"). `wikilinkTailSlug` also yields the bare slug for slug-style refs
  // ("[[my-feat]]" → "my-feat"), so it handles both shapes.
  const slug = wikilinkTailSlug(ref);
  const feats = ctx.core.entities.search("", "feat", Number.POSITIVE_INFINITY);
  // Prefer an EXACT full-slug match (covers bare-slug homebrew refs like
  // "[[my-feat]]"), so a homebrew "homebrew_alert" can't shadow "srd-2024_alert"
  // via the loose tail match. Fall back to the suffix match for compendium feats
  // whose slug is "<compendium>_<bare>". First tail match wins (acceptable).
  const lookup = (s: string): RegisteredEntity | undefined =>
    feats.find((f) => f.slug === s) ?? feats.find((f) => f.slug.endsWith(`_${s}`));
  let feat = lookup(slug);
  // Variant fallback: canonical 2024 Acolyte/Sage carry parenthesized refs like
  // "[[SRD 2024/Feats/Magic Initiate (Cleric)]]" whose tail slugifies to
  // "magic-initiate-cleric", but the only real feat is "srd-2024_magic-initiate".
  // Strip ONE trailing parenthetical from the RAW tail, re-slugify, and retry —
  // resolving to the BASE feat while still naming the VARIANT in the display.
  let variantName: string | undefined;
  if (!feat) {
    const rawTail = ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("/").pop()?.trim() ?? "";
    const base = rawTail.replace(/\s*\([^()]*\)\s*$/, "").trim();
    if (base && base !== rawTail) {
      const baseFeat = lookup(wikilinkTailSlug(`[[${base}]]`));
      if (baseFeat) {
        feat = baseFeat;
        variantName = rawTail; // honest about which variant the background grants
      }
    }
  }
  return { feat, display: variantName ?? feat?.name ?? slug };
}

/** Display name for the Origin Feat glance tile — the resolved feat name (or the
 *  parenthesized variant name), falling back to the bare slug. */
function originFeatDisplayName(ref: string): string {
  // Cheap display-only resolution that mirrors `resolveOriginFeat`'s naming but
  // never needs the registry: the tile shows the human-facing label only.
  const rawTail = ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("/").pop()?.trim() ?? "";
  return rawTail || wikilinkTailSlug(ref);
}

/** 2024 origin feat is FIXED per background — a quiet strip-dressed info row that
 *  names the feat with the feat block expandable beneath it (no selection). The
 *  feat block is inserted as the row's next sibling so the click toggles within
 *  the current render only (renderExpand re-runs on every redraw). */
function renderOriginFeatStripRow(host: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const r = resolveOriginFeat(ctx, e);
  if (!r) return;
  const row = renderStripInfoRow(host, { pill: "Feat", name: "Origin Feat", value: r.feat ? `${r.display} ▸` : r.display });
  if (!r.feat) return;
  // The whole row toggles the feat block (not just the crimson value); the
  // .expandable class opts the row into the pointer affordance.
  row.addClass("expandable");
  let open = false;
  row.addEventListener("click", () => {
    if (open) { host.querySelector(".pc-bofeat-expand")?.remove(); open = false; return; }
    const ex = host.createDiv({ cls: "pc-bofeat-expand" });
    row.insertAdjacentElement("afterend", ex);
    renderEntityBlock(ex, r.feat!, ctx.core);
    open = true;
  });
}

/** The "Proficiencies & starting gear" section: skills, fixed tool, fixed 2014
 *  languages, starting equipment (humanized items + ×n quantities + <gp> GP),
 *  and the 2014 feature as a trait-dress entry when it carries a description. */
function renderGearProps(host: HTMLElement, d: BackgroundData): void {
  renderSectionRule(host, "Proficiencies & starting gear");
  prop(host, "Skills", (d.skill_proficiencies ?? []).map(humanizeSlug).join(", "));
  const tool = fixedToolNames(d);
  if (tool) prop(host, "Tool", tool);
  const langs = fixedLanguageNames(d);
  if (langs) prop(host, "Languages", langs);
  const eq = (d.equipment ?? []).map((x) =>
    "kind" in x && x.kind === "currency" ? `${x.gp} GP`
      : `${humanizeSlug((x as { item: string }).item)}${((x as { quantity?: number }).quantity ?? 1) > 1 ? ` ×${(x as { quantity: number }).quantity}` : ""}`,
  );
  if (eq.length) prop(host, "Equipment", eq.join(", "));
  if (d.feature?.description && d.feature.description !== NO_DESC) {
    const row = host.createDiv({ cls: "pc-cb-trait" });
    row.createDiv({ cls: "pc-cb-trait-n", text: d.feature.name });
    row.createDiv({ cls: "pc-cb-trait-d", text: d.feature.description });
  }
}

function prop(host: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const p = host.createDiv({ cls: "pc-cb-prop" });
  p.createSpan({ cls: "pc-cb-prop-l", text: label });
  p.createSpan({ text: value });
}
