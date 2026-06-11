import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import { renderEntityPicker } from "./entity-picker";
import { renderEntityBlock } from "./entity-block";
import { renderDecisionLedger } from "./decision-ledger";
import { buildDecisionLedger } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";

/** Humanize a hyphenated proficiency slug for display, e.g. "sleight-of-hand"
 *  → "Sleight Of Hand". Kept local: `labelCase` in background.renderer.ts is
 *  module-scoped (not exported), so there is no shared helper to import. */
const labelCase = (s: string): string =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const skillsOf = (e: RegisteredEntity): string[] =>
  (e.data as { skill_proficiencies?: string[] }).skill_proficiencies ?? [];

const BG_COLUMNS: ColSpec[] = [
  {
    label: "Skills", cls: "col-skills", width: "180px",
    render: (cell, e) => {
      const s = skillsOf(e).map(labelCase);
      cell.setText(s.length ? s.join(", ") : "—");
    },
  },
];

/** SP2 §7 Step 4 — Background: the Race-style expandSelect ledger; the expanded
 *  chosen row composes the edition-mix banner, the entity block, the origin
 *  decision ledger, and the 2024 origin-feat row. Every other expanded row
 *  shows the entity block only. */
export function renderBackgroundStep(body: HTMLElement, ctx: ComponentRenderContext): void {
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
  const slug = ref.replace(/\[\[|\]\]/g, "");
  const feat = ctx.core.entities.search("", "feat", Number.POSITIVE_INFINITY).find(
    (f) => f.slug === slug || f.slug.endsWith(`_${slug}`),
  );
  const row = wrap.createDiv({ cls: "pc-bofeat" });
  row.createSpan({ cls: "pc-bofeat-l", text: "Origin Feat" });
  row.createSpan({ cls: "pc-bofeat-v", text: feat?.name ?? slug });
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
