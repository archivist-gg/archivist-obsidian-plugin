/**
 * The pool ENTRY's meta line: the economy label, the consume cost, and the row sub-line that prints
 * them. R4 {G5, G6} live rider 2, X-2-12: this module exists so the pool tab and the boon rows can
 * share ONE composer. `pool-tab.ts` and `actions/boon-rows.ts` must not import each other (the same
 * constraint that put `renderAffordanceCaption` and `renderControlGroup` in `entry-affordance.ts`),
 * and before this the composer lived in `pool-tab.ts` alone, so a picked entry filed on the Passive
 * tab carried no economy line at all while its pool row read `Passive · 1 Superiority Dice`.
 * Everything below is MOVED from `pool-tab.ts` with its docblocks; only `renderMetaSub` changed, by
 * gaining the class parameter its second caller needs.
 */
import type { ComponentRenderContext } from "../component.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import { renderSeparated } from "../separated-caption";
import { ACTION_COST_LONG_LABEL } from "../../../../shared/rendering/action-cost-label";

/* The ECONOMY label for a pool row's sub-line and a block card's Cost meta. R4 {G5, G6} live rider 2,
 * X-1-13: the label names the economy and carries no amount. `1 Action` / `1 Bonus Action` beside a
 * sibling row's bare `Reaction` read as a quantity of actions, and on a narrow column the pair
 * `Passive · 1 Bonus Action` broke across lines with the stray `1` ending one. The amount a reader
 * can act on is the COST, which `consumeCost` still prints with its number. R4-G7 T8 fix round 1 (W-D-D3): the five strings moved
 * to the shared action-cost label table as its LONG form (`shared/rendering/action-cost-label.ts`), which the row caption now reads
 * too; this name stays for its two readers (`metaSub` below, `pool-tab.ts`). */
export const COST_LABELS: Record<string, string> = ACTION_COST_LONG_LABEL;

/** Italic meta sub-line: "Passive", action cost, and consume cost.
 *
 *  R4 {G5, G6} live rider N-1-7: an entry that declares NEITHER `passive` NOR an `action_cost` reads
 *  "Passive" too. It is not a guess about the game: `featureEconomy` (the sheet's own filing rule,
 *  `actions/action-model.ts`) maps `free`, `special` and an ABSENT cost alike to the Passive & Free
 *  Actions bucket, so such an entry already lives under that heading everywhere else on the sheet and
 *  the row now says so instead of printing an empty sub-line. Measured live: in the fighting-style
 *  pool `Great Weapon Fighting` was the one row with no sub-line at all while its siblings read
 *  `Passive`, `Reaction` and `Passive · Special`. */
export function metaSub(e: OptionalFeatureEntity, ctx: ComponentRenderContext): string[] {
  const parts: string[] = [];
  if (e.passive || !e.action_cost) parts.push("Passive");
  if (e.action_cost) parts.push(COST_LABELS[e.action_cost] ?? e.action_cost);
  if (e.consumes?.amount) parts.push(consumeCost(e.consumes, ctx));
  return parts;
}

/** The row sub-line, one SEGMENT element per part (R4 {G5, G6} live rider 2, X-8-7). Since R4-G6b §10
 *  (Q-8) each part is a UNIT (`pc-cap-unit`) holding an out-of-flow ` · ` separator plus the BARE
 *  segment, and what divides two parts is the host's own space widened by its `word-spacing`: the
 *  composed `textContent` is byte-identical to the joined text this line has always carried, while a
 *  part that starts a wrapped line has its mark clipped away instead of leading the line. The
 *  segments exist so the CSS can forbid a break inside one, which is what split `Passive · 2` from
 *  `Sorcery Point` at the 356 px column. No part renders no line at all, as before.
 *
 *  `cls` is the LINE's own class and defaults to the pool row's: a boon row filed on the Passive tab
 *  passes the sub-label class those rows already style (X-2-12). The segment spans carry
 *  `pc-cap-seg pc-spell-sub-seg` either way, so the `white-space: nowrap` rule still matches them,
 *  and their `textContent` is the bare part (the separator is the unit's child, never theirs). */
export function renderMetaSub(nameWrap: HTMLElement, parts: string[], cls = "pc-spell-sub"): void {
  if (!parts.length) return;
  const sub = nameWrap.createDiv({ cls });
  renderSeparated(sub, parts, { sep: "·", segCls: "pc-spell-sub-seg" });
}

/** The "Cost" text for a `consumes` link, shared by the row sub-line and the block card's meta
 *  (R4-G4 §3.2.4). THREE sources for the name, in order: the resource's NAME from
 *  `resolved.resources` when the character OWNS it; else the name a registry entity DECLARES for that
 *  id (R4 {G5, G6} live rider V-5); else the raw id. Never singularized and never capitalized, because
 *  the old `.replace(/s$/, "")` + capitalize pair was game-vocabulary logic living in a renderer
 *  (invariant 3), and it printed "1 Fighter-2024:superiority-dice" on a Parry row. The declared lookup
 *  is not that logic returning: it reads a `name` a document authored beside the `id`, and it invents
 *  nothing when no document declares one. A `column` or absent link keeps the literal it always had. */
export function consumeCost(consumes: NonNullable<OptionalFeatureEntity["consumes"]>, ctx: ComponentRenderContext): string {
  const id = consumes.resource ?? consumes.column ?? "resource";
  const owned = consumes.resource ? ctx.resolved.resources?.get(consumes.resource)?.name : undefined;
  const name = consumes.resource ? (owned ?? declaredResourceNames(ctx).get(consumes.resource) ?? id) : id;
  return `${consumes.amount} ${name}`;
}

/** id → declared display name, for every resource ANY registered entity declares.
 *
 *  Why it exists: a cross-edition pick consumes a resource its owner does not own (a 2014 Battle
 *  Master's PHB 2024 maneuvers consume `fighter-2024:superiority-dice`), so `resolved.resources`, which
 *  indexes the CHARACTER's own features, misses and the id used to reach the sheet raw. The name is in
 *  the vault regardless: the PHB 2024 Fighter declares that id with `name: Superiority Dice`.
 *
 *  The walk is over SHAPE, not entity type: any registered document that carries a `resources[]`, at
 *  the top level or on a feature in `features_by_level`, contributes its `id` → `name` pairs. Nothing
 *  here names a class, a subclass or any other game word, so a homebrew document that declares
 *  resources is read exactly like a book one. The first declaration of an id wins, matching
 *  `resolveFeatureResources` in dnd5e, whose walk this mirrors · including its floor: like that walk,
 *  this one does NOT descend into `sub_features`, because a resource declared there is not in the
 *  character's index either, so descending would make the two disagree.
 *
 *  Built ONCE per sheet render and cached against the render CONTEXT, which `renderPCSheet` builds
 *  fresh on every pass: the cache therefore cannot outlive a compendium change, and a pool tab drawing
 *  a dozen rows walks the registry once rather than a dozen times. A context with no registry (every
 *  cast test fixture) memoises an empty map and every id stays raw. */
const DECLARED_RESOURCE_NAMES = new WeakMap<ComponentRenderContext, Map<string, string>>();

function declaredResourceNames(ctx: ComponentRenderContext): Map<string, string> {
  const cached = DECLARED_RESOURCE_NAMES.get(ctx);
  if (cached) return cached;
  const out = new Map<string, string>();
  const registry = ctx.services?.entities;
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    for (const r of value) {
      const res = r as { id?: unknown; name?: unknown };
      if (typeof res?.id !== "string" || typeof res.name !== "string") continue;
      if (!out.has(res.id)) out.set(res.id, res.name);
    }
  };
  if (registry) {
    for (const slug of registry.getAllSlugs()) {
      const data = registry.getBySlug(slug)?.data;
      if (!data) continue;
      collect(data.resources);
      const byLevel = data.features_by_level;
      if (!byLevel || typeof byLevel !== "object") continue;
      for (const features of Object.values(byLevel)) {
        if (!Array.isArray(features)) continue;
        for (const f of features) collect((f as { resources?: unknown })?.resources);
      }
    }
  }
  DECLARED_RESOURCE_NAMES.set(ctx, out);
  return out;
}
