import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "@archivist-gg/core";
import type { ColSpec } from "./selection-table";
import type { DecisionItem } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import type { BackgroundLanguageProficiency } from "@archivist-gg/dnd5e/background/background.types";
import type { StartingEquipmentEntry } from "@archivist-gg/dnd5e/types/equipment-grant";
import { renderEntityPicker } from "./entity-picker";
import { renderCustomBackgroundRow } from "./custom-background";
import { buildDecisionLedger, wikilinkTailSlug } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { resolveOriginFeat, stripSlug } from "@archivist-gg/dnd5e/pc/pc.resolver";
import { humanizeSlug, grantLabel } from "../../../../shared/rendering/renderer-utils";
import { renderChronicleBlock, renderSectionRule } from "./chronicle-block";
import { renderDecisionStrip, renderStripInfoRow, domainPill } from "./decision-strip";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";

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
  equipment?: StartingEquipmentEntry[];
  feature?: { name: string; description?: string };
  ability_score_increases?: { pool?: string[] } | null;
  origin_feat?: string | null;
  choices?: Array<{ kind: string; count?: number; points?: number; max_per?: number; pool?: string[] }>;
}

const stripSummary = (items: DecisionItem[]): string => {
  const done = items.filter((i) => i.status === "resolved").length;
  return `${items.length} total · ${done} resolved · ${items.length - done} open`;
};

/** Origin items the background step surfaces as live decision rows: the
 *  background's OWN choices PLUS the origin feat's own child choices (source
 *  "feat"). The engine files the feat's picks under "background:feat:<id>", so
 *  they belong to this step, letting a Magic Initiate origin feat's spell picker
 *  render here rather than being dropped. Race-source items are handled by the
 *  race step and are excluded. */
export const isBackgroundStripItem = (i: DecisionItem): boolean =>
  i.source.kind === "background" || i.source.kind === "feat";

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
      const ledger = chosen ? buildDecisionLedger(ctx.resolved, { registry: ctx.services.entities }) : null;
      const items = ledger?.origin.filter(isBackgroundStripItem) ?? [];
      // Shared lifted resolver (R2-m7): the SAME helper the resolver pipeline uses.
      const ofeat = chosen ? resolveOriginFeat(ctx.services.entities, d.origin_feat ?? null) : null;
      renderChronicleBlock(wrap, {
        name: e.name,
        sub: backgroundSub(d),
        badge: `${d.source ?? ""} · ${d.edition ?? ""}`.replace(/^ · | · $/g, ""),
        flavor: (d.description ?? "").trim() || undefined,
        pre: chosen ? (host) => renderEditionMixBanner(host, ctx, e) : undefined,
        // F13 guard: for the CHOSEN background the pipeline now owns the origin feat
        // (Feats row + strip reference below), so suppress the redundant glance tile
        // — otherwise the feat name would render TWICE in this block. Preview
        // (non-chosen) rows keep the tile as an at-a-glance summary.
        tiles: backgroundTiles(d, chosen),
        body: (host) => {
          if (chosen && (items.length || ofeat)) {
            renderSectionRule(host, "What you decide", stripSummary(items));
            renderDecisionStrip(host, ctx, { items, pill: domainPill, live: true, stateKey: "builder.background-strip" });
            // Append the fixed origin-feat REFERENCE row into the SAME strip root so
            // it sits beside the decision rows (F13: reference only — the pipeline
            // owns the feat's full card, see renderOriginFeatStripRow).
            const strip = host.querySelector<HTMLElement>(".pc-dstrip") ?? host.createDiv({ cls: "pc-dstrip" });
            renderOriginFeatStripRow(strip, ctx, e);
          }
          renderGearProps(host, ctx, d);
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
 *  Feat. 2014: Skills / Tool (when present) / Languages / Feature.
 *  `suppressOriginFeat` (F13): drop the 2024 Origin Feat tile for the CHOSEN
 *  background, whose feat the resolver pipeline now surfaces (Feats row + the
 *  origin-feat strip reference), so it is not shown twice in one block. */
function backgroundTiles(
  d: BackgroundData,
  suppressOriginFeat = false,
): Array<{ label: string; value: string; small?: string }> {
  const skills = (d.skill_proficiencies ?? []).map(humanizeSlug).join(", ");
  const tool = fixedToolNames(d);
  const is2024 = !!d.ability_score_increases || (d.choices ?? []).some((c) => c.kind === "ability-points");
  if (is2024) {
    return [
      ...(skills ? [{ label: "Skills", value: skills }] : []),
      ...(tool ? [{ label: "Tool", value: tool }] : []),
      ...abilityPointsTile(d),
      ...(suppressOriginFeat ? [] : originFeatTile(d)),
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
      `Your species ${race?.name ?? ""} already grants ability increases, and this background grants them too, ` +
      `which is more than a standard character. Keep both if your table allows it, or pick a matching-edition background.`,
  });
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
 *  NAMES the feat (no selection). F13 guard: the resolver pipeline now OWNS this
 *  feat — it renders as a real **Feats** row (and its full expandable feat card)
 *  and applies its effects via `resolved.features`. So the builder shows only a
 *  lightweight name REFERENCE here and no longer re-renders the whole feat block
 *  (which would duplicate the pipeline's card). Uses the SAME lifted resolver as
 *  the sheet (R2-m7), extracting the ref from `e.data.origin_feat`. */
function renderOriginFeatStripRow(host: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const ref = (e.data as { origin_feat?: string | null }).origin_feat ?? null;
  const r = resolveOriginFeat(ctx.services.entities, ref);
  if (!r) return;
  renderStripInfoRow(host, { pill: "Feat", name: "Origin Feat", value: r.display });
}

/** The "Proficiencies & starting gear" section: skills, fixed tool, fixed 2014
 *  languages, starting equipment (humanized items + ×n quantities + <gp> GP),
 *  and the 2014 feature as a trait-dress entry when it carries a description. */
function renderGearProps(host: HTMLElement, ctx: ComponentRenderContext, d: BackgroundData): void {
  renderSectionRule(host, "Proficiencies & starting gear");
  prop(host, "Skills", (d.skill_proficiencies ?? []).map(humanizeSlug).join(", "));
  const tool = fixedToolNames(d);
  if (tool) prop(host, "Tool", tool);
  const langs = fixedLanguageNames(d);
  if (langs) prop(host, "Languages", langs);
  const eqLines: string[] = [];
  for (const e of d.equipment ?? []) {
    if (e.kind === "choice") eqLines.push(e.options.map((o) => o.label).join("  or  "));
    else if (e.kind === "fixed") eqLines.push(e.label ?? e.grants.map(grantLabel).join(", "));
    else eqLines.push(`${e.amount} GP`);
  }
  const eqText = eqLines.filter(Boolean).join("; ");
  if (eqText) prop(host, "Equipment", eqText);
  if (d.feature?.description && d.feature.description !== NO_DESC) {
    const row = host.createDiv({ cls: "pc-cb-trait" });
    row.createDiv({ cls: "pc-cb-trait-n", text: d.feature.name });
    // Shared markdown path (smoke r7): a 2014 feature's description may carry a
    // pipe table; render it as a real table with the `.catch` error-paint idiom.
    const dd = row.createDiv({ cls: "pc-cb-trait-d" });
    void renderMarkdownDescription(dd, d.feature.description, ctx.app).catch((err: unknown) => {
      console.error("[Archivist] background feature description render failed", err);
      dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
    });
  }
}

function prop(host: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const p = host.createDiv({ cls: "pc-cb-prop" });
  p.createSpan({ cls: "pc-cb-prop-l", text: label });
  p.createSpan({ text: value });
}
