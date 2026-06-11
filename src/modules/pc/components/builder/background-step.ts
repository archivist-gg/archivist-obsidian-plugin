import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import { renderEntityPicker } from "./entity-picker";
import { renderCustomBackgroundRow } from "./custom-background";
import { renderEntityBlock } from "./entity-block";
import { renderDecisionLedger } from "./decision-ledger";
import { buildDecisionLedger, wikilinkTailSlug } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";
import { humanizeSlug } from "../../../../shared/rendering/renderer-utils";

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

/** SP2 §7 Step 4 — Background: the Race-style expandSelect ledger; the expanded
 *  chosen row composes the edition-mix banner, the entity block, the origin
 *  decision ledger, and the 2024 origin-feat row. Every other expanded row
 *  shows the entity block only. */
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
    renderExpand: (wrap, e) => {
      const chosen = e.slug === stripSlug(ctx.resolved.definition.background);
      // Banner first (mockup intent: edition-mix note sits ABOVE the block), then
      // the block, then decisions — but only for the STANDING pick. A freshly-
      // clicked row becomes the pick via onSelect; the onChange re-render composes
      // the extras on the restore pass (by then it IS the chosen row).
      if (chosen) renderEditionMixBanner(wrap, ctx, e);
      renderEntityBlock(wrap, e, ctx.core);
      if (!chosen) return;
      const ledger = buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities });
      renderDecisionLedger(wrap, ctx, { ledger, origin: "background", stateKey: "builder.background-ledger" });
      renderOriginFeatRow(wrap, ctx, e);
    },
  });
}

/** §6: the one mechanical edition-mix conflict — a species that grants ability
 *  increases combined with a 2024-style background pool. Permissive: an amber
 *  note, never a block. Fires only when BOTH the background carries an ASI pool
 *  and the species grants ability increases (fixed or a choice). */
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

/** 2024 origin feat is FIXED per background — an informational row that names the
 *  feat with the feat block expandable beneath it (no selection to make).
 *  `renderExpand` re-runs on every redraw, so `open` and the expanded DOM both
 *  reset together on each pass: a click toggles within the current render only. */
function renderOriginFeatRow(wrap: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const ref = (e.data as { origin_feat?: string | null }).origin_feat;
  if (!ref) return;
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
  // resolving to the BASE feat while still naming the VARIANT in the display span.
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
  const row = wrap.createDiv({ cls: "pc-bofeat" });
  row.createSpan({ cls: "pc-bofeat-l", text: "Origin Feat" });
  row.createSpan({ cls: "pc-bofeat-v", text: variantName ?? feat?.name ?? slug });
  if (!feat) return;
  row.createSpan({ cls: "pc-bofeat-x", text: "›" });
  let open = false;
  row.addEventListener("click", () => {
    if (open) {
      wrap.querySelector(".pc-bofeat-expand")?.remove();
      open = false;
      return;
    }
    const ex = wrap.createDiv({ cls: "pc-bofeat-expand" });
    renderEntityBlock(ex, feat, ctx.core);
    open = true;
  });
}
