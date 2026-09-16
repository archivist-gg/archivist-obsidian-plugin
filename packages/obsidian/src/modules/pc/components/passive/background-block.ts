import type { ComponentRenderContext } from "../component.types";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";
import type { StartingEquipmentEntry } from "@archivist-gg/dnd5e/types/equipment-grant";
import { wikilinkTailSlug } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { humanizeSlug, fixedGrantLines, fixedNamesFrom } from "../../../../shared/rendering/renderer-utils";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";
import { renderChronicleBlock, renderSectionRule } from "../builder/chronicle-block";
import { rowExpandKey, isRowExpanded, setRowExpanded } from "../row-expand-state";

/** The generator-baked placeholder every 2024 SRD background carries in place of a
 *  per-feature description (`background-merge.ts`). Detected exactly (name +
 *  description) so a real 2014 feature is never mistaken for it (spec §4.1). */
const PLACEHOLDER_NAME = "Background Feature";
const NO_DESC = "(No description provided.)";

/** A `.pc-cb-prop` reference line: a caps label + its value. Omitted when empty. */
function prop(host: HTMLElement, label: string, value: string, cls?: string): void {
  if (!value) return;
  const p = host.createDiv({ cls: cls ? `pc-cb-prop ${cls}` : "pc-cb-prop" });
  p.createSpan({ cls: "pc-cb-prop-l", text: label });
  p.createSpan({ text: value });
}

/** Starting-equipment reference — the same display strings the builder shows,
 *  joined into one line (this block references, it does not grant). */
function equipmentSummary(equipment: StartingEquipmentEntry[] | undefined): string {
  const lines: string[] = [];
  for (const e of equipment ?? []) {
    if (e.kind === "choice") lines.push(e.options.map((o) => o.label).join("  or  "));
    else if (e.kind === "fixed") lines.push(fixedGrantLines(e));
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

  // D3: the Passive tab dropped the badge column (3-col grid), so this row emits
  // NO `.pc-feature-badge` cell — its three grid children are nameCell, detail,
  // and caret, matching the passive feature/boon rows beside it (mirrors
  // race-block.ts).

  // Name cell: the background name, with the edition as the quiet sub-label (the
  // same slot feature rows use for their source line). Sub-label omitted when the
  // background carries no edition.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: bg.name });
  if (bg.edition) nameCell.createDiv({ cls: "pc-action-row-sub", text: String(bg.edition) });

  // Detail column kept present-but-empty, the feature rows' (name | detail | caret) cell order. Being EMPTY, it leaves the
  // grid and its track goes to the name (R4-G7 T8 wave D fix round 1, W-D-D6, `styles/actions.css` `.pc-feature-detail:empty`).
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
      //    Languages reads the FIXED entries only, by POLICY: this block
      //    REFERENCES applied grants, and an unresolved pick belongs to the
      //    builder. A `kind:"choice"` language entry is NOT impossible · none of
      //    the four 2024 SRD backgrounds has one (each carries
      //    `{kind:"fixed",languages:["common"]}` plus the pick in `choices[]`),
      //    but the one 2014 SRD background does: `srd-5e_background_acolyte` is
      //    `[{kind:"choice",count:2,from:"any"}]` with no fixed entry. It is
      //    dropped here deliberately, and nothing is lost · that background also
      //    carries the pick in `choices[]` as a `select-proficiency`, so the
      //    builder still surfaces it. When a background grants no fixed language
      //    the row is omitted entirely by `prop()`.
      prop(host, "Skills", (bg.skill_proficiencies ?? []).map(humanizeSlug).join(", "));
      prop(host, "Tools", fixedNamesFrom(bg.tool_proficiencies, "items").join(", "));
      prop(host, "Languages", fixedNamesFrom(bg.language_proficiencies, "languages").join(", "));

      // ── Origin Feat line (2024 only), a labeled prop() row like its siblings.
      //    "· see Feats" auto-appends once the feat renders as a Feats row
      //    (Task 3b); before that it degrades to the name. ──
      if (bg.origin_feat) {
        const name = originFeatName(bg.origin_feat);
        // R4-G4 §8: the resolver stamps `originFeatSlug` on the resolved character OUTSIDE the
        // feats de-dup guard in `PCResolver.resolve`, so the block asks whether THAT feat is in
        // `resolved.features` instead of re-deriving the tail. The retired `originFeatRendersAsRow`
        // matched on `endsWith("_" + baseSlug)` (and on the display name), which a DIFFERENT
        // same-tailed feat also satisfied, so it could light the row for a feat this background
        // never granted.
        const stamped = ctx.resolved.originFeatSlug;
        const seeFeats = !!stamped && ctx.resolved.features.some((f) => f.source.kind === "feat" && f.source.slug === stamped);
        prop(host, "Origin Feat", `${name}${seeFeats ? " · see Feats" : ""}`, "pc-bg-origin");
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
