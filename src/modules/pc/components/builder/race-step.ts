import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import { renderEntityPicker } from "./entity-picker";
import { renderEntityBlock } from "./entity-block";
import { renderChoiceCallout } from "./choice-callout";
import { renderDecisionLedger } from "./decision-ledger";
import { buildDecisionLedger } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";

// Honest ledger columns for the race picker — size/speed exist in the entity
// data today. Sorted by rank order (not alphabetically) and walking speed.
const SIZE_ORDER = ["tiny", "small", "medium", "large", "huge"];
const sizeOf = (e: RegisteredEntity): string => String((e.data as { size?: string }).size ?? "");
const walkOf = (e: RegisteredEntity): number =>
  Number((e.data as { speed?: { walk?: number } }).speed?.walk ?? 0);
const RACE_COLUMNS: ColSpec[] = [
  {
    label: "Size", cls: "col-size", width: "90px",
    sort: (a, b) => SIZE_ORDER.indexOf(sizeOf(a)) - SIZE_ORDER.indexOf(sizeOf(b)),
    render: (cell, e) => {
      const s = sizeOf(e);
      cell.setText(s ? s.charAt(0).toUpperCase() + s.slice(1) : "—");
    },
  },
  {
    label: "Speed", cls: "col-speed", width: "90px",
    sort: (a, b) => walkOf(a) - walkOf(b),
    render: (cell, e) => {
      const w = walkOf(e);
      cell.setText(w ? `${w} ft.` : "—");
    },
  },
];

/** SP2 §7 Step 1 — the Race / Species step. Plan 4: expandSelect ledger
 *  (row click = solo-expand = selected; class-step decisions doc). The chosen
 *  race's expanded row composes the entity block + Subrace callout + the
 *  race-origin decision ledger; every other expanded row shows the block only. */
export function renderRaceStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const chosen = stripSlug(ctx.resolved.definition.race);
  renderEntityPicker(body, ctx, {
    entityType: "race",
    stateKey: "builder.race-picker",
    selectedSlug: chosen,
    onSelect: (slug) => ctx.editState?.setRace(slug),
    columns: RACE_COLUMNS,
    expandSelect: true,
    renderExpand: (wrap, e) => {
      renderEntityBlock(wrap, e, ctx.core);
      // Subrace + racial decisions belong to the STANDING pick only — a
      // freshly-clicked row becomes the pick via onSelect, and the onChange
      // re-render composes them on the restore pass (by then it IS the chosen).
      if (e.slug !== stripSlug(ctx.resolved.definition.race)) return;
      renderSubraceCallout(wrap, ctx, e);
      const ledger = buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities });
      renderDecisionLedger(wrap, ctx, { ledger, origin: "race", stateKey: "builder.race-ledger" });
    },
  });
}

/** 2014 subraces ride the race entity (`race.subraces[].slug` — the same slugs
 *  the race block merges traits by). 2024 lineages are authored as decision
 *  choices and arrive through the origin ledger instead, so no chips render for
 *  them (by design). Silently no-ops when the entity carries no `subraces`. */
function renderSubraceCallout(wrap: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const subraces = (e.data as { subraces?: Array<{ slug: string; name?: string }> }).subraces ?? [];
  if (!subraces.length) return;
  const cur = stripSlug(ctx.resolved.definition.subrace ?? null);
  renderChoiceCallout(wrap.createDiv(), {
    label: "Subrace",
    choose: 1,
    options: subraces.map((s) => ({ value: s.slug, label: s.name ?? s.slug })),
    selected: new Set(cur ? [cur] : []),
    required: true,
    onToggle: (value) => ctx.editState?.setSubrace(value === cur ? null : value),
  });
}
