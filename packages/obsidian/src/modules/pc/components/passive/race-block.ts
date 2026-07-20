import type { ComponentRenderContext } from "../component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";
import { renderChronicleBlock, renderSectionRule } from "../builder/chronicle-block";

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
 * card, which fills with the FULL chronicle block — the same
 * `renderChronicleBlock` shell the builder's Race step renders: identity band
 * (species name + "Species · Size · Speed · Darkvision" sub-line + "<source> ·
 * <edition>" corner badge), the flavor paragraph, the glance tiles (Size / Speed
 * / Darkvision-when-granted), and a "Traits" rule over one row per real trait.
 * The block's own outer card chrome (tinted background, tan border, box-shadow,
 * padding) is stripped in CSS (`.pc-action-expand-inner > .pc-cblock`) so it sits
 * FLUSH in the already-padded expand — no nested double-card. Unlike the builder
 * it carries NO decision strip / subrace row (those are builder-only, and the
 * stateless tab has no strip to host them).
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

  // Badge column: kept present-but-empty so the 4-col feature-row grid stays
  // aligned with its siblings. The redundant "Passive" tag was removed (Task 6):
  // on the Passive tab every row is passive, so the tag was pure noise.
  row.createDiv({ cls: "pc-feature-badge" });

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

  // ── Sibling expand card (hidden until the row is clicked): the FULL chronicle
  //    block, its outer card chrome stripped in CSS so it sits flush here. ──
  const expand = list.createDiv({ cls: "pc-action-expand pc-open-expand" });
  expand.hidden = true;
  const inner = expand.createDiv({ cls: "pc-action-expand-inner" });

  // The same `renderChronicleBlock` shell the builder's Race step renders (title
  // band + sub-line + source badge + flavor + glance tiles + caller body), so the
  // expand reads as the full race block "with title and everything". The nested
  // card chrome is stripped by `.pc-action-expand-inner > .pc-cblock` (chronicle.css).
  const darkvision = race.vision?.darkvision;
  renderChronicleBlock(inner, {
    name: race.name,
    // Italic sub-line: "Species" plus only the size/speed/darkvision segments the
    // race actually carries — empties dropped so no "· ·" gaps appear.
    sub: [
      "Species",
      race.size ? cap(race.size) : "",
      race.speed?.walk != null ? `${race.speed.walk} ft.` : "",
      darkvision ? `Darkvision ${darkvision} ft.` : "",
    ].filter(Boolean).join(" · "),
    // Corner badge "<source> · <edition>", collapsing to undefined when both are
    // empty (so no bare " · " badge renders).
    badge: `${race.source} · ${race.edition}`.replace(/^ · | · $/g, "").trim() || undefined,
    // Flavor paragraph; omitted entirely when the race has no description.
    flavor: race.description.trim() || undefined,
    // Glance tiles: Size / Speed / Darkvision — each shown only when granted.
    tiles: [
      ...(race.size ? [{ label: "Size", value: cap(race.size) }] : []),
      ...(race.speed?.walk != null ? [{ label: "Speed", value: String(race.speed.walk), small: "ft." }] : []),
      ...(darkvision ? [{ label: "Darkvision", value: String(darkvision), small: "ft." }] : []),
    ],
    // Body: trait rows under a "Traits" rule — every trait that is NOT a
    // size/speed/darkvision pseudo-trait, INCLUDING choice-bearing ones (which the
    // stateless tab must not hide; the narrower RACE_TILE_FOLD keeps them). No
    // decision strip / subrace row — those are builder-only.
    body: (host) => {
      const traits = (race.traits ?? []).filter((t) => !RACE_TILE_FOLD.has(t.name.toLowerCase()));
      if (!traits.length) return;
      renderSectionRule(host, "Traits", "from the species entry");
      for (const t of traits) {
        const traitRow = host.createDiv({ cls: "pc-cb-trait" });
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
    },
  });

  // Row click toggles the sibling expand (tiles + trait rows). Stateless: the
  // `.hidden` flag lives on the DOM node, reset each render (default collapsed).
  // Mirrors the feature-row open/close class toggles exactly.
  row.addEventListener("click", () => {
    expand.hidden = !expand.hidden;
    row.classList.toggle("open", !expand.hidden);
    row.classList.toggle("pc-row-open", !expand.hidden);
  });
}
