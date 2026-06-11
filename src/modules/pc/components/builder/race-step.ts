import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import { renderEntityPicker } from "./entity-picker";
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
 *  (row click = solo-expand = selected; class-step decisions doc). Subrace +
 *  racial decision callouts compose into the expanded row in a later task. */
export function renderRaceStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  renderEntityPicker(body, ctx, {
    entityType: "race",
    stateKey: "builder.race-picker",
    selectedSlug: stripSlug(ctx.resolved.definition.race),
    onSelect: (slug) => ctx.editState?.setRace(slug),
    columns: RACE_COLUMNS,
    expandSelect: true,
  });
}
