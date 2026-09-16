import type { ComponentRenderContext } from "../component.types";
import type { ResolvedResource } from "@archivist-gg/dnd5e/pc/pc.resources";
import type { ResetTrigger } from "@archivist-gg/dnd5e/types/resource";
import type { EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { resolveResourceIndex } from "@archivist-gg/dnd5e/pc/pc.resources";
import { formatSourceLabel } from "../../blocks/feature-card";

/**
 * The Resources tab's MODEL: every spendable thing the character owns, grouped
 * by what gives it back. Pure — no DOM, no Obsidian — so the grouping rule is
 * testable on its own and the renderer holds none of it.
 *
 * Three row kinds reach the same list because at the table they are the same
 * question ("what have I got left?"): a feature/pool resource, a hit die, and an
 * item's charges. Their write-backs differ, so the kind is a tagged union the
 * renderer dispatches on rather than a flag.
 */

export type ResourceRow =
  /** A `resolveResourceIndex` entry with a seeded `feature_uses` counter. */
  | { kind: "resource"; key: string; name: string; sub: string[]; res: ResolvedResource; used: number; max: number }
  /** One `state.hit_dice` key. `face` is the die ("d8"); `max` its total. */
  | { kind: "hit-dice"; key: string; name: string; sub: string[]; face: string; used: number; max: number }
  /** One equipment entry carrying persisted `state.charges`. `index` is the
   *  ORIGINAL equipment index — the filter-stable write-back key
   *  `editState.setItemCharges` takes (the rule `items-table.ts` states). */
  | { kind: "item"; key: string; name: string; sub: string[]; index: number; used: number; max: number;
      recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" } };

export interface ResourceGroup {
  /** The heading text, e.g. "Short Rest". */
  heading: string;
  rows: ResourceRow[];
}

export const SHORT_REST = "Short Rest";
export const LONG_REST = "Long Rest";
export const NO_RESET = "Doesn't reset";

/**
 * Reset trigger → heading, EXHAUSTIVE over `ResetTrigger`.
 *
 * `Record<ResetTrigger, string>` is the guard `./actions/reset-labels.ts`
 * established: a member added to dnd5e's union fails the build here until it is
 * given a group, rather than silently falling into a bucket.
 *
 * THREE groups and no more, because the question the tab answers is "what does a
 * rest give me back?" and a rest has exactly two lengths. `either` (short OR
 * long) files under **Short Rest**: the axis is the EARLIEST rest that returns
 * it, and a player scanning before a short rest must see it. The four cadence
 * triggers (`dawn`, `dusk`, `turn`, `round`) and `custom` all file under
 * **Doesn't reset** — no rest returns them, which is the only thing this axis
 * asks. A cadence resource that DOES trickle back says so in its own recovery
 * caption on the row (Sanity sits here reading "+1 / Long Rest").
 */
const RESET_GROUP: Record<ResetTrigger, string> = {
  "short-rest": SHORT_REST,
  either: SHORT_REST,
  "long-rest": LONG_REST,
  dawn: NO_RESET,
  dusk: NO_RESET,
  turn: NO_RESET,
  round: NO_RESET,
  custom: NO_RESET,
};

/** Item charges join the "Doesn't reset" group. They speak a DIFFERENT recovery
 *  vocabulary (`dawn|short|long|special`, the persisted item keyspace) that no
 *  rest in this model restores; the entry's own recovery still prints as this
 *  row's caption, the way a partial-recovery resource's does. */
const ITEM_GROUP = NO_RESET;

/** Hit dice file under Short Rest: a short rest is when they are spent, which is
 *  the moment the player opens this tab looking for them (the approved design
 *  puts them exactly there). */
const HIT_DICE_GROUP = SHORT_REST;

/** Headings in render order. A group with no rows is dropped by
 *  {@link collectResourceGroups}, so this is an ordering, not a layout. */
const GROUP_ORDER: readonly string[] = [SHORT_REST, LONG_REST, NO_RESET];

/** The source sub-label for an indexed resource: the owning feature's source
 *  through the shared formatter (so a campaign grant reads "Campaign" and a
 *  class feature "Fighter 5"), or the owning pool's own label. */
function resourceSub(res: ResolvedResource, ctx: ComponentRenderContext): string[] {
  if (res.owner.kind === "pool") return [res.owner.poolLabel].filter(Boolean);
  return [formatSourceLabel(res.owner.source, ctx.resolved)].filter(Boolean);
}

/** The item's display name: the registry entity's, else the bare slug. */
function itemName(entry: EquipmentEntry, ctx: ComponentRenderContext): string {
  const slug = entry.item.match(/^\[\[(.+)\]\]$/)?.[1] ?? entry.item;
  const reg = ctx.services?.entities as { getBySlug?: (s: string) => { data?: { name?: string } } | null } | undefined;
  return entry.overrides?.name ?? reg?.getBySlug?.(slug)?.data?.name ?? slug;
}

/** Hit-dice rows, lowest face first (the `HitDiceWidget`'s own order). */
function hitDiceRows(ctx: ComponentRenderContext): ResourceRow[] {
  const hd = ctx.resolved.state?.hit_dice ?? {};
  return Object.keys(hd)
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))
    .map((face) => {
      const { used, total } = hd[face];
      const row: ResourceRow = { kind: "hit-dice", key: `hit-dice:${face}`, name: "Hit Dice", sub: [], face, used, max: total };
      return row;
    });
}

/**
 * Every resource row the character has, grouped and ordered.
 *
 * `resolveResourceIndex` is derived PER CALL rather than read off
 * `resolved.resources` — the `computeRestPlan` precedent, because the cast
 * fixtures behind several suites build a `ResolvedCharacter` without the stored
 * index while carrying real `features` / `pools`.
 *
 * An index entry with no `state.feature_uses` counter yields NO row: there is
 * nothing to track (a prose `uses.max` never seeds one), and an empty detail
 * cell would collapse the row's grid through the `:has(> .pc-feature-detail:empty)`
 * rule in `actions.css`.
 *
 * EVERY resource is listed. `surface` selects what the header band ALSO shows and
 * never removes anything from here: this tab is the complete inventory, and a
 * resource missing from it would be a bug.
 */
export function collectResourceGroups(ctx: ComponentRenderContext): ResourceGroup[] {
  const byHeading = new Map<string, ResourceRow[]>();
  const push = (heading: string, row: ResourceRow) => {
    const rows = byHeading.get(heading);
    if (rows) rows.push(row);
    else byHeading.set(heading, [row]);
  };

  // 1. Hit dice, one row per die type.
  for (const row of hitDiceRows(ctx)) push(HIT_DICE_GROUP, row);

  // 2. Features and pool picks, through the ONE index.
  const uses = ctx.resolved.state?.feature_uses ?? {};
  for (const res of resolveResourceIndex(ctx.resolved).values()) {
    const fu = uses[res.id];
    if (!fu) continue;
    push(RESET_GROUP[res.reset], {
      kind: "resource", key: `resource:${res.id}`, name: res.name,
      sub: resourceSub(res, ctx), res, used: fu.used, max: fu.max,
    });
  }

  // 3. Item charges, keyed on the ORIGINAL equipment index.
  //
  // EQUIPPED ONLY, the rule `collectActionItems` already states for the Actions
  // tab ("Only equipped items surface on this tab", action-model.ts). This tab
  // answers "what can I spend right now?", and a wand in the bottom of the pack
  // is not something the character can spend without first taking it out. The
  // row returns the moment it is equipped again; the charges are never lost,
  // because they live on the equipment entry and nothing here writes to them.
  //
  // NOTE the asymmetry with the rest modal, which offers an unequipped item's
  // recharge regardless: a wand does regain its charges overnight whether or not
  // it was in hand, and hiding that would silently cost the player charges.
  // Hiding a row the player cannot use is safe; skipping a refill is not.
  (ctx.resolved.definition?.equipment ?? []).forEach((entry, index) => {
    if (!entry.equipped) return;
    const charges = entry.state?.charges;
    if (!charges || charges.max <= 0) return;
    push(ITEM_GROUP, {
      kind: "item", key: `item:${index}`, name: itemName(entry, ctx), sub: ["Item"], index,
      used: Math.max(0, charges.max - charges.current), max: charges.max,
      ...(entry.state?.recovery ? { recovery: entry.state.recovery } : {}),
    });
  });

  // Ordered, empties dropped. A heading outside GROUP_ORDER cannot occur —
  // RESET_GROUP is exhaustive over `ResetTrigger` and every value of it is
  // listed there — but the concat keeps the function total rather than silent.
  const known = GROUP_ORDER.filter((h) => byHeading.has(h));
  const extra = [...byHeading.keys()].filter((h) => !GROUP_ORDER.includes(h));
  return [...known, ...extra].map((heading) => ({ heading, rows: byHeading.get(heading)! }));
}

/**
 * The header band's resource rows: every resource whose DECLARING NOTE says
 * `surface: band`. Hit dice are not here — they are ALWAYS in the band and reach
 * it through the shipped `HitDiceWidget`, which `ResourceBand` mounts itself
 * (only that widget carries the multiclass chip row).
 *
 * A resource with no seeded counter is skipped: the band is a readout, and a
 * resource with nothing to count has no number to read.
 *
 * ONE criterion, `surface === "band"`, so which resources sit in the header is a
 * decision the character's own files make and the renderer never second-guesses.
 */
export function collectBandRows(ctx: ComponentRenderContext): ResourceRow[] {
  const out: ResourceRow[] = [];
  const uses = ctx.resolved.state?.feature_uses ?? {};
  for (const res of resolveResourceIndex(ctx.resolved).values()) {
    if (res.surface !== "band") continue;
    const fu = uses[res.id];
    if (!fu) continue;
    out.push({ kind: "resource", key: `resource:${res.id}`, name: res.name, sub: resourceSub(res, ctx), res, used: fu.used, max: fu.max });
  }
  return out;
}
