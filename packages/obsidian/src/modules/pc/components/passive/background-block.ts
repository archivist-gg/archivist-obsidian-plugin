import type { ComponentRenderContext } from "../component.types";
import type {
  BackgroundEntity,
  BackgroundToolProficiency,
  BackgroundLanguageProficiency,
} from "@archivist-gg/dnd5e/background/background.types";
import type { StartingEquipmentEntry } from "@archivist-gg/dnd5e/types/equipment-grant";
import { wikilinkTailSlug } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { humanizeSlug, grantLabel } from "../../../../shared/rendering/renderer-utils";

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
 * Build-order-aware "— see Feats" gate (spec §4.1, R3-M8). The origin feat only
 * renders as a Feats row once Task 3b wires it into the feat pipeline, so we do a
 * self-adjusting RUNTIME check rather than a hardcoded flag: is there a
 * feat-sourced resolved feature that matches this origin-feat ref? Match by the
 * bare tail slug (`srd-2024_savage-attacker` endsWith `_savage-attacker`), the
 * parenthetical-variant base slug (Magic Initiate (Cleric) → magic-initiate), or
 * the display name. Absent (today) → "Origin Feat: <name>"; present (post-3b) →
 * "… — see Feats", with NO cross-task edit.
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
 * The bespoke read-only **Background block** on the Passive & Features tab (spec
 * §4.1, D2-3(i)), mirroring the Race block. It reads `resolved.background`
 * directly and REFERENCES the grants already applied elsewhere (skills → Skills
 * panel, tools → Proficiencies, ability boosts → Ability panel) — it does NOT
 * re-list them, so nothing double-counts.
 *
 * For the 4 SRD-2024 backgrounds the generator bakes a "Background Feature —
 * (No description provided.)" placeholder (pre-split out of the passive model in
 * `passive-features-tab.ts`), so this block shows the applied grants as reference
 * lines plus the Origin Feat line. A 2014 background carries genuine `feature`
 * prose and `origin_feat:null` → the real prose is surfaced (NOT suppressed).
 *
 * Collapse is the same self-contained `.hidden` DOM-toggle the Race/feature rows
 * use; default EXPANDED. Renders nothing when there is no background.
 */
export function renderBackgroundBlock(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const bg: BackgroundEntity | null = ctx.resolved.background;
  if (!bg) return;

  const block = parent.createDiv({ cls: "pc-cblock pc-background-block" });

  // ── Collapsible header: "Background · <name>" + edition badge + chevron. ──
  const header = block.createDiv({ cls: "pc-cb-bh collapsible pc-background-block-head" });
  const ident = header.createDiv({ cls: "pc-cb-bh-ident" });
  ident.createDiv({ cls: "pc-cb-name", text: `Background · ${bg.name}` });
  if (bg.edition) ident.createSpan({ cls: "pc-cb-ed", text: String(bg.edition) });
  const chevron = header.createSpan({ cls: "pc-cb-bh-chev", text: "▾" });

  const body = block.createDiv({ cls: "pc-background-block-body" });

  // ── Genuine flavor/description text, when the background carries any, at the
  //    TOP of the block (R3-M6). The 2024 SRD placeholder is skipped. ──
  const flavor = bg.description?.trim();
  if (flavor && flavor !== NO_DESC) {
    body.createDiv({ cls: "pc-cb-trait-d pc-bg-flavor", text: flavor });
  }

  // ── Ability-boost reference: the granted pool (applied totals live in the
  //    Ability panel). 2024 only; null for 2014. ──
  const pool = bg.ability_score_increases?.pool ?? [];
  if (pool.length) prop(body, "Ability Scores", pool.map((a) => a.toUpperCase()).join(" · "));

  // ── Proficiency references: skills / tools / languages. ──
  prop(body, "Skills", (bg.skill_proficiencies ?? []).map(humanizeSlug).join(", "));
  prop(body, "Tools", fixedToolNames(bg.tool_proficiencies));
  prop(body, "Languages", languageSummary(bg.language_proficiencies));

  // ── Origin Feat line (2024 only). "— see Feats" auto-appends once the feat
  //    renders as a Feats row (Task 3b); before that it degrades to the name. ──
  if (bg.origin_feat) {
    const name = originFeatName(bg.origin_feat);
    const seeFeats = originFeatRendersAsRow(ctx, bg.origin_feat);
    body.createDiv({
      cls: "pc-cb-prop pc-bg-origin",
      text: `Origin Feat: ${name}${seeFeats ? " — see Feats" : ""}`,
    });
  }

  // ── Starting-equipment reference. ──
  prop(body, "Equipment", equipmentSummary(bg.equipment));

  // ── 2014 real feature prose (NOT the 2024 placeholder → suppressed). ──
  const feat = bg.feature;
  const isPlaceholder = feat?.name === PLACEHOLDER_NAME && feat?.description === NO_DESC;
  if (feat && !isPlaceholder && feat.description?.trim()) {
    const row = body.createDiv({ cls: "pc-cb-trait pc-bg-feature" });
    row.createDiv({ cls: "pc-cb-trait-n", text: feat.name });
    row.createDiv({ cls: "pc-cb-trait-d", text: feat.description });
  }

  // Header click toggles the whole body. Stateless `.hidden` flag on the DOM
  // node, reset each render (default expanded).
  header.addEventListener("click", () => {
    body.hidden = !body.hidden;
    chevron.setText(body.hidden ? "▸" : "▾");
    header.classList.toggle("collapsed", body.hidden);
  });
}
