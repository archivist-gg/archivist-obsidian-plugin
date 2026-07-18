import type { ComponentRenderContext } from "../component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";

/**
 * The pseudo-traits surfaced as glance tiles (Size / Speed / Darkvision) and so
 * folded OUT of the trait rows, matched by lowercased trait name.
 *
 * This mirrors the builder's fold set *conceptually* but is deliberately a
 * NARROWER filter than `race-step.ts:120-123`: the builder ALSO drops
 * `!t.choices?.length`, moving decision-bearing traits into its decision strip.
 * The stateless Passive & Features tab has no strip, so copying that clause would
 * HIDE choice-bearing racial traits (Elf/Gnome "Lineage", "Keen Senses"). We fold
 * ONLY the three size/speed/darkvision pseudo-traits; a literal "Creature Type"
 * trait (Kalashtar) is not in the set and renders as a normal row (spec §3.2,
 * R1-F4/#7).
 */
export const RACE_TILE_FOLD = new Set(["size", "speed", "darkvision"]);

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** A trait's display prose: its `description`, else joined `entries`, else "". */
function traitDescription(t: Feature): string {
  if (t.description && t.description.trim()) return t.description;
  if (t.entries && t.entries.length) return t.entries.join("\n\n");
  return "";
}

/**
 * The bespoke read-only **Race block** on the Passive & Features tab (spec §3,
 * D2-2). It reads `resolved.race` (`RaceEntity`) DIRECTLY — never the passive
 * action model — so an `action`-cost trait (which files under Actions→Race in the
 * model) is still shown here, and the redundant Size/Speed pseudo-trait rows the
 * model would emit are folded into glance tiles instead.
 *
 * Layout: a clickable "Race · <species>" header + chevron over a body of glance
 * tiles (Size, Speed, Darkvision-when-granted) and one row per real trait. The
 * collapse is a self-contained `.hidden` DOM-toggle at the block level — the same
 * state-free idiom feature rows use (`feature-rows.ts`); it does NOT touch
 * `ctx.builderUiState`/`redraw()`, which the stateless tab can't host. Default
 * EXPANDED. Renders nothing when there is no race.
 */
export function renderRaceBlock(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const race: RaceEntity | null = ctx.resolved.race;
  if (!race) return;

  const block = parent.createDiv({ cls: "pc-cblock pc-race-block" });

  // ── Collapsible header: "Race · <species>" + chevron (default expanded). ──
  const header = block.createDiv({ cls: "pc-cb-bh collapsible pc-race-block-head" });
  const ident = header.createDiv({ cls: "pc-cb-bh-ident" });
  ident.createDiv({ cls: "pc-cb-name", text: `Race · ${race.name}` });
  const chevron = header.createSpan({ cls: "pc-cb-bh-chev", text: "▾" });

  const body = block.createDiv({ cls: "pc-race-block-body" });

  // ── Glance tiles: Size, Speed (ft.), Darkvision (ft. — only when granted). ──
  const glance = body.createDiv({ cls: "pc-cb-glance" });
  const tile = (label: string, value: string, small?: string): void => {
    const t = glance.createDiv({ cls: "pc-cb-tile" });
    t.createDiv({ cls: "pc-cb-tl", text: label });
    const v = t.createDiv({ cls: "pc-cb-tv" });
    v.createSpan({ text: value });
    if (small) v.createSpan({ cls: "pc-cb-ts", text: small });
  };
  if (race.size) tile("Size", cap(race.size));
  // `speed.walk` is optional → null-guard to an em dash rather than "undefined".
  tile("Speed", race.speed?.walk != null ? String(race.speed.walk) : "—", "ft.");
  const darkvision = race.vision?.darkvision;
  if (darkvision) tile("Darkvision", String(darkvision), "ft.");

  // ── Trait rows: every trait that is NOT a size/speed/darkvision pseudo-trait,
  //    including choice-bearing traits (which the sheet must not hide). ──
  const traits = (race.traits ?? []).filter((t) => !RACE_TILE_FOLD.has(t.name.toLowerCase()));
  for (const t of traits) {
    const row = body.createDiv({ cls: "pc-cb-trait pc-race-trait" });
    row.createDiv({ cls: "pc-cb-trait-n", text: t.name });
    const desc = traitDescription(t);
    if (desc) row.createDiv({ cls: "pc-cb-trait-d", text: desc });
  }

  // Header click toggles the whole body (tiles + trait rows). Stateless: the
  // `.hidden` flag lives on the DOM node, reset each render (default expanded).
  header.addEventListener("click", () => {
    body.hidden = !body.hidden;
    chevron.setText(body.hidden ? "▸" : "▾");
    header.classList.toggle("collapsed", body.hidden);
  });
}
