import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { ColSpec } from "./selection-table";
import type { DecisionItem } from "../../pc.decision-engine";
import { renderEntityPicker } from "./entity-picker";
import { buildDecisionLedger } from "../../pc.decision-engine";
import { stripSlug } from "../../pc.resolver";
import { renderChronicleBlock, renderSectionRule, firstSentence } from "./chronicle-block";
import { renderDecisionStrip, domainPill } from "./decision-strip";

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
    renderExpand: (wrap, e) => {
      // The strip + Decisions tile belong to the STANDING pick only — a freshly-
      // clicked row becomes the pick via onSelect, and the onChange re-render
      // composes them on the restore pass (by then it IS the chosen race).
      const isChosen = e.slug === stripSlug(ctx.resolved.definition.race);
      const d = e.data as RaceData;
      const ledger = isChosen ? buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities }) : null;
      const items = ledger?.origin.filter((i) => i.source.kind === "race") ?? [];
      const doneN = items.filter((i) => i.status === "resolved").length;
      const dv = d.vision?.darkvision;
      renderChronicleBlock(wrap, {
        name: e.name,
        sub: ["Species", cap(d.size ?? ""), d.speed?.walk ? `${d.speed.walk} ft.` : "", dv ? `Darkvision ${dv} ft.` : ""]
          .filter(Boolean).join(" · "),
        badge: `${d.source ?? ""} · ${d.edition ?? ""}`.replace(/^ · | · $/g, ""),
        flavor: (d.description ?? "").trim() || undefined,
        tiles: [
          ...(d.size ? [{ label: "Size", value: cap(d.size) }] : []),
          ...(d.speed?.walk ? [{ label: "Speed", value: String(d.speed.walk), small: "ft." }] : []),
          ...(dv ? [{ label: "Darkvision", value: String(dv), small: "ft." }] : []),
          ...(isChosen && items.length ? [{ label: "Decisions", value: String(items.length), small: `${doneN} done` }] : []),
        ],
        body: (host) => {
          if (isChosen && (items.length || (d.subraces?.length ?? 0))) {
            renderSectionRule(host, "What you decide", stripSummary(items));
            renderSubraceRow(host, ctx, e);                 // strip-dressed; no-ops without d.subraces
            renderDecisionStrip(host, ctx, { items, pill: domainPill, live: true, stateKey: "builder.race-strip" });
          }
          renderTraits(host, d);
        },
      });
    },
  });
}

/** The "Traits" section: serif name + ` ▸ decision` meta when the trait carries
 *  `choices`, first sentence of the description, and a `Read full ▸` link that
 *  toggles the remainder in place. Size/Speed/Darkvision are folded out (they
 *  live in the glance tiles). */
function renderTraits(host: HTMLElement, d: RaceData): void {
  const traits = (d.traits ?? []).filter((t) => !FOLDED.has(t.name.toLowerCase()));
  if (!traits.length) return;
  renderSectionRule(host, "Traits", "from the species entry");
  for (const t of traits) {
    const row = host.createDiv({ cls: "pc-cb-trait" });
    const n = row.createDiv({ cls: "pc-cb-trait-n", text: t.name });
    if (t.choices?.length) n.createSpan({ cls: "pc-cb-trait-meta", text: "▸ decision" });
    const head = firstSentence(t.description);
    const desc = row.createDiv({ cls: "pc-cb-trait-d", text: head });
    // trimEnd so a trailing-whitespace-only tail doesn't surface a "Read full"
    // that reveals nothing but blanks.
    if (head.length < t.description.trimEnd().length) {
      const more = desc.createSpan({ cls: "pc-cb-more", text: " Read full ▸" });
      let open = false;
      more.addEventListener("click", () => {
        open = !open;
        desc.setText(open ? t.description : head);
        desc.appendChild(more);                             // keep the toggle in the row
        more.setText(open ? " Show less ▴" : " Read full ▸");
      });
    }
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
