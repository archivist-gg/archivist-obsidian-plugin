import type { ComponentRenderContext } from "../component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";

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
 * The read-only **Race** section on the Passive & Features tab (spec §3, D2-2;
 * D7.1). It reads `resolved.race` (`RaceEntity`) DIRECTLY, never the passive
 * action model, so an `action`-cost trait (which files under Actions→Race in the
 * model) is still shown here, and the redundant Size/Speed pseudo-trait rows the
 * model would emit are folded into glance tiles instead.
 *
 * Rehoused (D7.1) into the sheet's native **section → row → expand** idiom, the
 * exact shape Class Features uses: a `.pc-tab-heading` "Race" heading, then ONE
 * flat `.pc-action-row.pc-feature-row` (Passive badge + species name + caret) in
 * a `.pc-feature-list`. Clicking the row reveals the sibling `.pc-action-expand`
 * card holding the glance tiles (Size / Speed / Darkvision-when-granted) and one
 * row per real trait: the same content the retired bespoke `.pc-race-block`
 * chronicle card carried, minus the standalone card chrome and the combined
 * "Race · <species>" header.
 *
 * Collapse is the same self-contained `.hidden` DOM-toggle the feature rows use
 * (`feature-rows.ts`): the flag lives on the DOM node, reset each render, so it
 * does NOT touch `ctx.builderUiState`/`redraw()`, which the stateless tab can't
 * host. Default COLLAPSED, matching the sibling rows. Renders nothing when there
 * is no race.
 */
export function renderRaceBlock(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const race: RaceEntity | null = ctx.resolved.race;
  if (!race) return;

  // ── Section heading: the shared `.pc-tab-heading` the section renderer emits,
  //    so "Race" reads as a peer section to the tab's other headings. ──
  parent.createEl("h4", { cls: "pc-tab-heading", text: "Race" });

  // ── Flat feature-row list (one row): the same list container Class Features
  //    rows live in, so the row inherits the feature-row grid + dress. ──
  const list = parent.createDiv({ cls: "pc-actions-table pc-feature-list" });
  const row = list.createDiv({ cls: "pc-action-row pc-feature-row" });

  // Badge column: a race is always-on, so it wears the same outline "Passive"
  // tag every passive feature row shows (mirrors feature-rows.ts).
  const badge = row.createDiv({ cls: "pc-feature-badge" });
  badge.createDiv({ cls: "pc-passive-tag", text: "Passive" });

  // Name cell: the species name, with the size as the quiet sub-label (the same
  // slot feature rows use for their source line). Size sub-label omitted when the
  // race carries no size.
  const nameCell = row.createDiv({ cls: "pc-action-namecell" });
  nameCell.createDiv({ cls: "pc-action-row-name", text: race.name });
  if (race.size) nameCell.createDiv({ cls: "pc-action-row-sub", text: cap(race.size) });

  // Detail column kept present-but-empty so the 4-col feature-row grid
  // (badge | name | detail | caret) stays aligned with its siblings.
  row.createDiv({ cls: "pc-feature-detail" });
  row.createDiv({ cls: "pc-action-caret", text: "›" });

  // ── Sibling expand card (hidden until the row is clicked): the glance tiles +
  //    trait rows moved verbatim off the retired bespoke card. ──
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });

  // Glance tiles: Size, Speed (ft.), Darkvision (ft., only when granted).
  const glance = inner.createDiv({ cls: "pc-cb-glance" });
  const tile = (label: string, value: string, small?: string): void => {
    const t = glance.createDiv({ cls: "pc-cb-tile" });
    t.createDiv({ cls: "pc-cb-tl", text: label });
    const v = t.createDiv({ cls: "pc-cb-tv" });
    v.createSpan({ text: value });
    if (small) v.createSpan({ cls: "pc-cb-ts", text: small });
  };
  if (race.size) tile("Size", cap(race.size));
  // `speed.walk` is optional → null-guard to a middle dot rather than "undefined".
  tile("Speed", race.speed?.walk != null ? String(race.speed.walk) : "·", "ft.");
  const darkvision = race.vision?.darkvision;
  if (darkvision) tile("Darkvision", String(darkvision), "ft.");

  // Trait rows: every trait that is NOT a size/speed/darkvision pseudo-trait,
  // including choice-bearing traits (which the sheet must not hide).
  const traits = (race.traits ?? []).filter((t) => !RACE_TILE_FOLD.has(t.name.toLowerCase()));
  for (const t of traits) {
    const traitRow = inner.createDiv({ cls: "pc-cb-trait" });
    traitRow.createDiv({ cls: "pc-cb-trait-n", text: t.name });
    // The description renders through the SHARED markdown path (ctx.app threaded,
    // async) so a trait carrying a pipe table shows a real table, not raw `|...|`
    // text. The `.catch` paints a visible error div; the `.pc-cb-trait-d`
    // container keeps its dress, which the rendered `p`/`table` inherit via CSS.
    const descText = traitDescription(t);
    if (descText) {
      const dd = traitRow.createDiv({ cls: "pc-cb-trait-d" });
      void renderMarkdownDescription(dd, descText, ctx.app).catch((err: unknown) => {
        console.error("[Archivist] race trait description render failed", err);
        dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
      });
    }
  }

  // Row click toggles the sibling expand (tiles + trait rows). Stateless: the
  // `.hidden` flag lives on the DOM node, reset each render (default collapsed).
  // Mirrors the feature-row open/close class toggles exactly.
  row.addEventListener("click", () => {
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
}
