import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "@archivist-gg/core";
import type { ColSpec } from "./selection-table";
import type { DecisionItem } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { renderEntityPicker } from "./entity-picker";
import { buildDecisionLedger } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { stripSlug } from "@archivist-gg/dnd5e/pc/pc.resolver";
import { renderChronicleBlock, renderSectionRule } from "./chronicle-block";
import { renderDecisionStrip, domainPill } from "./decision-strip";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";

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

/** Entity-data shape the picker hands `renderExpand` for the race step. */
interface RaceData {
  size?: string; speed?: { walk?: number }; vision?: { darkvision?: number };
  description?: string;
  source?: string; edition?: string;
  traits?: Array<{ name: string; description: string; choices?: unknown[] }>;
  subraces?: Array<{ slug: string; name?: string }>;
}

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Traits folded into the glance tiles (Size / Speed / Darkvision) — never shown
// again as their own trait rows.
const FOLDED = new Set(["size", "speed", "darkvision"]);

const stripSummary = (items: DecisionItem[]): string => {
  const done = items.filter((i) => i.status === "resolved").length;
  return `${items.length} total · ${done} resolved · ${items.length - done} open`;
};

/** SP2 §1 (Plan 5) — the Race / Species step. The chosen species' expanded row
 *  composes ONE Chronicle block: identity band + glance tiles (Size / Speed /
 *  Darkvision / Decisions) + an always-open decision strip under a "What you
 *  decide" rule (Subrace row first, then race-origin ledger items) + a "Traits"
 *  rule with the species traits (Size/Speed/Darkvision folded out). Every other
 *  expanded row renders the same block WITHOUT the strip + Decisions tile. */
export function renderRaceStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const chosen = stripSlug(ctx.resolved.definition.race);
  renderEntityPicker(body, ctx, {
    entityType: "race",
    stateKey: "builder.race-picker",
    selectedSlug: chosen,
    onSelect: (slug) => ctx.editState?.setRace(slug),
    columns: RACE_COLUMNS,
    expandSelect: true,
    // The chosen species' block always shows (smoke r6): its row is the resting
    // default expansion.
    defaultExpandSlug: chosen ?? undefined,
    renderExpand: (wrap, e) => {
      // The strip + Decisions tile belong to the STANDING pick only — a freshly-
      // clicked row becomes the pick via onSelect, and the onChange re-render
      // composes them on the restore pass (by then it IS the chosen race).
      const isChosen = e.slug === stripSlug(ctx.resolved.definition.race);
      const d = e.data as RaceData;
      const ledger = isChosen ? buildDecisionLedger(ctx.resolved, { registry: ctx.services.entities }) : null;
      const items = ledger?.origin.filter((i) => i.source.kind === "race") ?? [];
      const dv = d.vision?.darkvision;
      renderChronicleBlock(wrap, {
        name: e.name,
        sub: ["Species", cap(d.size ?? ""), d.speed?.walk ? `${d.speed.walk} ft.` : "", dv ? `Darkvision ${dv} ft.` : ""]
          .filter(Boolean).join(" · "),
        badge: `${d.source ?? ""} · ${d.edition ?? ""}`.replace(/^ · | · $/g, ""),
        flavor: (d.description ?? "").trim() || undefined,
        // Size / Speed / Darkvision only — the "Decisions" glance tile was dropped
        // (smoke r6); the decision strip below carries the same count.
        tiles: [
          ...(d.size ? [{ label: "Size", value: cap(d.size) }] : []),
          ...(d.speed?.walk ? [{ label: "Speed", value: String(d.speed.walk), small: "ft." }] : []),
          ...(dv ? [{ label: "Darkvision", value: String(dv), small: "ft." }] : []),
        ],
        body: (host) => {
          if (isChosen && (items.length || (d.subraces?.length ?? 0))) {
            renderSectionRule(host, "What you decide", stripSummary(items));
            renderSubraceRow(host, ctx, e);                 // strip-dressed; no-ops without d.subraces
            renderDecisionStrip(host, ctx, { items, pill: domainPill, live: true, stateKey: "builder.race-strip" });
          }
          renderTraits(host, ctx, d);
        },
      });
    },
  });
}

/** The "Traits" section: serif name + the COMPLETE description (smoke r6 — no
 *  first-sentence truncation or Read-full toggle; traits read in full at a glance).
 *  Size/Speed/Darkvision are folded out (they live in the glance tiles).
 *
 *  Decision-bearing traits (those carrying `choices`) are EXCLUDED here (smoke r8):
 *  since round 7 they ALSO surface in the "What you decide" strip with their full
 *  description + controls, so listing them again here duplicated the trait. Their
 *  single home is now the strip; the Traits section keeps only the non-decision
 *  traits (e.g. Fey Ancestry, Trance). With decision traits gone, no trait carries
 *  the `▸ decision` meta any more, so that meta is no longer rendered. */
function renderTraits(host: HTMLElement, ctx: ComponentRenderContext, d: RaceData): void {
  const traits = (d.traits ?? [])
    .filter((t) => !FOLDED.has(t.name.toLowerCase()))
    .filter((t) => !t.choices?.length);
  if (!traits.length) return;
  renderSectionRule(host, "Traits", "from the species entry");
  for (const t of traits) {
    const row = host.createDiv({ cls: "pc-cb-trait" });
    row.createDiv({ cls: "pc-cb-trait-n", text: t.name });
    // The description renders through the SHARED markdown path (ctx.app threaded,
    // async) so a trait carrying a pipe table — e.g. the Elf's "Elven Lineage"
    // lineage table — shows a real table instead of raw `|...|` text (smoke r7).
    // The `.catch` paints a visible error div (Plan-2 idiom); the `.pc-cb-trait-d`
    // container keeps its dress, which the rendered `p`/`table` inherit via CSS.
    const dd = row.createDiv({ cls: "pc-cb-trait-d" });
    void renderMarkdownDescription(dd, t.description, ctx.app).catch((err: unknown) => {
      console.error("[Archivist] trait description render failed", err);
      dd.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
    });
  }
}

/** Subrace = the first strip row when the entity carries a `subraces` array
 *  (no SRD entity does — 2014 subraces are flattened entries; homebrew may).
 *  Same data contract as the retired Plan-4 callout, now in strip dress.
 *  Bypasses renderDecisionStrip because a subrace is not a DecisionItem — it
 *  writes the dedicated `character.subrace` field via setSubrace, not an origin
 *  choice. */
function renderSubraceRow(host: HTMLElement, ctx: ComponentRenderContext, e: RegisteredEntity): void {
  const subraces = (e.data as RaceData).subraces ?? [];
  if (!subraces.length) return;
  const cur = stripSlug(ctx.resolved.definition.subrace ?? null);
  const row = host.createDiv({ cls: `pc-dstrip-row ${cur ? "done" : "open"}` });
  row.createSpan({ cls: "pc-dstrip-pill", text: "Subrace" });
  if (!cur) row.createSpan({ cls: "pc-dstrip-bang", text: "!" });
  row.createSpan({ cls: "pc-dstrip-name", text: "Subrace" });
  row.createSpan({
    cls: "pc-dstrip-val",
    text: cur ? `✓ ${subraces.find((s) => s.slug === cur)?.name ?? cur}` : "choose 1",
  });
  const nest = row.createDiv({ cls: "pc-dstrip-nest" });
  const chips = nest.createDiv({ cls: "pc-bchoice-chips" });
  for (const s of subraces) {
    const sel = s.slug === cur;
    const chip = chips.createSpan({
      cls: `pc-bchoice-chip${sel ? " sel" : ""}`,
      text: sel ? `✓ ${s.name ?? s.slug}` : (s.name ?? s.slug),
    });
    chip.addEventListener("click", () => ctx.editState?.setSubrace(sel ? null : s.slug));
  }
}
