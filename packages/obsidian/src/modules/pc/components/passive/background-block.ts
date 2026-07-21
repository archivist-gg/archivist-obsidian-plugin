import type { ComponentRenderContext } from "../component.types";
import type {
  BackgroundEntity,
  BackgroundToolProficiency,
  BackgroundLanguageProficiency,
} from "@archivist-gg/dnd5e/background/background.types";
import type { StartingEquipmentEntry } from "@archivist-gg/dnd5e/types/equipment-grant";
import { wikilinkTailSlug } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { humanizeSlug, grantLabel } from "../../../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";
import { renderChronicleBlock, renderSectionRule } from "../builder/chronicle-block";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";

/** The generator-baked placeholder every 2024 SRD background carries in place of a
 *  per-feature description (`background-merge.ts`). Detected exactly (name +
 *  description) so a real 2014 feature is never mistaken for it (spec §4.1). */
const PLACEHOLDER_NAME = "Background Feature";
const NO_DESC = "(No description provided.)";

/** A `.pc-cb-prop` reference line: a caps label + its value. Omitted when empty. */
function prop(host: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const p = host.createDiv({ cls: "pc-cb-prop" });
  p.createSpan({ cls: "pc-cb-prop-l", text: label });
  p.createSpan({ text: value });
}

/** Fixed tool name(s) humanized — only `kind:"fixed"` entries carrying items. */
function fixedToolNames(tools: BackgroundToolProficiency[] | undefined): string {
  return (tools ?? [])
    .filter((t): t is Extract<BackgroundToolProficiency, { kind: "fixed" }> => t.kind === "fixed")
    .flatMap((t) => (t.items ?? []).map(humanizeSlug))
    .join(", ");
}

/** Language reference: fixed names when present, else the choice entry → "choose N". */
function languageSummary(langs: BackgroundLanguageProficiency[] | undefined): string {
  const fixed = (langs ?? [])
    .filter((l): l is Extract<BackgroundLanguageProficiency, { kind: "fixed" }> => l.kind === "fixed")
    .flatMap((l) => l.languages.map(humanizeSlug));
  if (fixed.length) return fixed.join(", ");
  const choice = (langs ?? []).find(
    (l): l is Extract<BackgroundLanguageProficiency, { kind: "choice" }> => l.kind === "choice",
  );
  return choice ? `choose ${choice.count ?? 1}` : "";
}

/** Starting-equipment reference — the same display strings the builder shows,
 *  joined into one line (this block references, it does not grant). */
function equipmentSummary(equipment: StartingEquipmentEntry[] | undefined): string {
  const lines: string[] = [];
  for (const e of equipment ?? []) {
    if (e.kind === "choice") lines.push(e.options.map((o) => o.label).join("  or  "));
    else if (e.kind === "fixed") lines.push(e.label ?? e.grants.map(grantLabel).join(", "));
    else lines.push(`${e.amount} GP`);
  }
  return lines.filter(Boolean).join("; ");
}

/** Human display name for an origin-feat ref — the raw wikilink tail (keeps the
 *  parenthesized variant, e.g. "Magic Initiate (Cleric)"), falling back to the
 *  slugified tail. Mirrors `background-step.ts:originFeatDisplayName`. */
function originFeatName(ref: string): string {
  const rawTail = ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("/").pop()?.trim() ?? "";
  return rawTail || wikilinkTailSlug(ref);
}

/**
 * Build-order-aware "see Feats" gate (spec §4.1, R3-M8). The origin feat only
 * renders as a Feats row once Task 3b wires it into the feat pipeline, so we do a
 * self-adjusting RUNTIME check rather than a hardcoded flag: is there a
 * feat-sourced resolved feature that matches this origin-feat ref? Match by the
 * bare tail slug (`srd-2024_savage-attacker` endsWith `_savage-attacker`), the
 * parenthetical-variant base slug (Magic Initiate (Cleric) → magic-initiate), or
 * the display name. Absent (today) → "Origin Feat: <name>"; present (post-3b) →
 * "… · see Feats", with NO cross-task edit.
 */
function originFeatRendersAsRow(ctx: ComponentRenderContext, ref: string): boolean {
  const slug = wikilinkTailSlug(ref);
  const rawTail = ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("/").pop()?.trim() ?? "";
  const base = rawTail.replace(/\s*\([^()]*\)\s*$/, "").trim();
  const baseSlug = base && base !== rawTail ? wikilinkTailSlug(`[[${base}]]`) : "";
  const name = (rawTail || slug).toLowerCase();
  const matchesSlug = (s: string): boolean =>
    !!s &&
    (s === slug ||
      s.endsWith(`_${slug}`) ||
      (!!baseSlug && (s === baseSlug || s.endsWith(`_${baseSlug}`))));
  return ctx.resolved.features.some(
    (f) =>
      f.source.kind === "feat" &&
      (matchesSlug(f.source.slug) || f.feature.name.toLowerCase() === name),
  );
}

/**
 * The read-only **Background** section on the Passive & Features tab (spec §4.1,
 * D2-3(i); Task 5). It reads `resolved.background` directly and REFERENCES the
 * grants already applied elsewhere (skills → Skills panel, tools → Proficiencies,
 * ability boosts → Ability panel) — it does NOT re-list them, so nothing
 * double-counts.
 *
 * Rehoused (Task 5) into the sheet's native **section → row → expand** idiom, the
 * EXACT shape the Race block (`race-block.ts`) uses: a `.pc-tab-heading`
 * "Background" heading, then ONE flat `.pc-action-row.pc-feature-row` (Passive
 * badge + background name + caret) in a `.pc-feature-list`. Clicking the row
 * reveals the sibling `.pc-action-expand` card, which fills with the FULL
 * chronicle block (`renderChronicleBlock`) — identity band (name + "Background"
 * sub-line + edition corner badge), then the caller body. The block's card chrome
 * (parchment fill, rounded, soft shadow) is applied in CSS
 * (`.pc-action-expand-inner > .pc-cblock`) so it reads as a proper card matching
 * the feature card, sitting inside the already-padded expand.
 *
 * FLAVOR PARITY: `renderChronicleBlock`'s `flavor` option renders PLAIN text, but
 * `bg.description` may carry markdown/tables, so it is deliberately NOT passed as
 * `flavor` — instead it is rendered via `renderMarkdownDescription` at the TOP of
 * the `body` callback (skipping the 2024 SRD `NO_DESC` placeholder), preserving
 * rich rendering. For the 4 SRD-2024 backgrounds the generator bakes a "Background
 * Feature — (No description provided.)" placeholder (pre-split out of the passive
 * model in `passive-features-tab.ts`), so the body shows the applied grants as
 * reference lines plus the Origin Feat line. A 2014 background carries genuine
 * `feature` prose and `origin_feat:null` → the real prose is surfaced (NOT
 * suppressed).
 *
 * Collapse is the same `.hidden` DOM-toggle the Race/feature rows use, but the
 * open state is now PERSISTED (P3 D1): it is recorded in `ctx.builderUiState` under
 * `background:<slug>` and re-applied on render, so a click survives the whole-sheet
 * re-render every editState mutation fires (previously the flag lived only on the
 * DOM node and reset each render). Default COLLAPSED, matching the Race block and
 * the sibling rows. Renders nothing when there is no background.
 */
export function renderBackgroundBlock(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const bg: BackgroundEntity | null = ctx.resolved.background;
  if (!bg) return;

  // ── Section heading: the shared `.pc-tab-heading`, so "Background" reads as a
  //    peer section to the tab's other headings (mirrors the Race block). ──
  parent.createEl("h4", { cls: "pc-tab-heading", text: "Background" });

  // ── Flat feature-row list (one row): the same list container the Race + Class
  //    Feature rows live in, so the row inherits the feature-row grid + dress. ──
  const list = parent.createDiv({ cls: "pc-actions-table pc-feature-list" });
  const row = list.createDiv({ cls: "pc-action-row pc-feature-row" });

  // Badge column: kept present-but-empty so the 4-col feature-row grid stays
  // aligned with its siblings. The redundant "Passive" tag was removed (Task 6):
  // on the Passive tab every row is passive, so the tag was pure noise (mirrors
  // race-block.ts).
  row.createDiv({ cls: "pc-feature-badge" });

  // Name cell: the background name, with the edition as the quiet sub-label (the
  // same slot feature rows use for their source line). Sub-label omitted when the
  // background carries no edition.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: bg.name });
  if (bg.edition) nameCell.createDiv({ cls: "pc-action-row-sub", text: String(bg.edition) });

  // Detail column kept present-but-empty so the 4-col feature-row grid
  // (badge | name | detail | caret) stays aligned with its siblings.
  row.createDiv({ cls: "pc-feature-detail" });
  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // ── Sibling expand card (hidden until the row is clicked): the FULL chronicle
  //    block, carded by `.pc-action-expand-inner > .pc-cblock` (chronicle.css). ──
  const expandKey = rowExpandKey("background", bg.slug);
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  const expanded = isRowExpanded(ctx, expandKey);
  expand.hidden = !expanded;
  if (expanded) row.classList.add("open", "pc-row-open");
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });

  renderChronicleBlock(inner, {
    name: bg.name,
    // Italic sub-line: a quiet "Background" tagline (mirrors the Race block's
    // "Species …" lead; a background carries no size/speed-style glance data).
    sub: "Background",
    // Corner badge: the edition, collapsing to undefined when absent (so no bare
    // badge renders).
    badge: bg.edition ? String(bg.edition) : undefined,
    // No glance tiles — a background has no at-a-glance stats to surface.
    tiles: [],
    // NOTE: `flavor` is deliberately NOT passed here — `renderChronicleBlock`
    // renders `flavor` as PLAIN text, but `bg.description` may carry markdown /
    // tables, so it is rendered via `renderMarkdownDescription` at the TOP of the
    // body (below) to preserve rich rendering (content parity with the old block).
    body: (host) => {
      // ── Genuine flavor/description text, when the background carries any, at
      //    the TOP of the block (R3-M6), through the shared markdown path so
      //    tables/lists render. The 2024 SRD placeholder is skipped. ──
      const flavor = bg.description?.trim();
      if (flavor && flavor !== NO_DESC) {
        const dd = host.createDiv({ cls: "pc-cb-trait-d pc-bg-flavor" });
        void renderMarkdownDescription(dd, flavor, ctx.app).catch((err: unknown) => {
          console.error("[Archivist] background flavor render failed", err);
          dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
        });
      }

      // A quiet rule over the applied-grant reference lines (mirrors the Race
      // block's "Traits" rule), so the mechanical summary reads as its own group.
      renderSectionRule(host, "Details");

      // ── Ability-boost reference: the granted pool (applied totals live in the
      //    Ability panel). 2024 only; null for 2014. ──
      const pool = bg.ability_score_increases?.pool ?? [];
      if (pool.length) prop(host, "Ability Scores", pool.map((a) => a.toUpperCase()).join(" · "));

      // ── Proficiency references: skills / tools / languages. ──
      prop(host, "Skills", (bg.skill_proficiencies ?? []).map(humanizeSlug).join(", "));
      prop(host, "Tools", fixedToolNames(bg.tool_proficiencies));
      prop(host, "Languages", languageSummary(bg.language_proficiencies));

      // ── Origin Feat line (2024 only). "· see Feats" auto-appends once the feat
      //    renders as a Feats row (Task 3b); before that it degrades to the name. ──
      if (bg.origin_feat) {
        const name = originFeatName(bg.origin_feat);
        const seeFeats = originFeatRendersAsRow(ctx, bg.origin_feat);
        host.createDiv({
          cls: "pc-cb-prop pc-bg-origin",
          text: `Origin Feat: ${name}${seeFeats ? " · see Feats" : ""}`,
        });
      }

      // ── Starting-equipment reference. ──
      prop(host, "Equipment", equipmentSummary(bg.equipment));

      // ── 2014 real feature prose (NOT the 2024 placeholder → suppressed). ──
      const feat = bg.feature;
      const isPlaceholder = feat?.name === PLACEHOLDER_NAME && feat?.description === NO_DESC;
      if (feat && !isPlaceholder && feat.description?.trim()) {
        const featRow = host.createDiv({ cls: "pc-cb-trait pc-bg-feature" });
        featRow.createDiv({ cls: "pc-cb-trait-n", text: feat.name });
        const dd = featRow.createDiv({ cls: "pc-cb-trait-d" });
        void renderMarkdownDescription(dd, feat.description, ctx.app).catch((err: unknown) => {
          console.error("[Archivist] background feature render failed", err);
          dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
        });
      }
    },
  });

  // Row click toggles the sibling expand. The open state is persisted in
  // `ctx.builderUiState` under `background:<slug>` (P3 D1) and re-applied on
  // render, so a click survives the whole-sheet re-render every editState mutation
  // fires (default COLLAPSED). Mirrors the Race / feature-row toggles exactly.
  row.addEventListener("click", () => {
    expand.hidden = !expand.hidden;
    const nowOpen = !expand.hidden;
    row.classList.toggle("open", nowOpen);
    row.classList.toggle("pc-row-open", nowOpen);
    setRowExpanded(ctx, expandKey, nowOpen);
  });
}
