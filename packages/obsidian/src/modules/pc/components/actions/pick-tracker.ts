import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderResourceTracker } from "./resource-tracker";
import { resourceLevelFor } from "@archivist-gg/dnd5e/pc/pc.resources";

/**
 * The pick's OWN tracker (R4-G4 §12): `feature_uses[entry.slug]`, seeded by `seedFeatureUses` from
 * the `uses.max` the pool walk in `resolveResourceIndex` put into the resource index, drawn by
 * `renderResourceTracker` (`./resource-tracker`, R4-G5 §4.3.2), which owns the widget choice this
 * file used to spell out: the at-will sentinel first, then the `CHARGE_BOX_LIMIT` ceiling into
 * `renderPointPool`, plus the `RESET_LABELS` caption and the `custom` tooltip. What stays this file's
 * own is the resource-index lookup, the two guards below, the `pc-pick-track` class it passes as
 * `trackClass` and the atomic `setFeatureUse` writer. An optional feature's `uses` never enters
 * `resolved.features`, so this is the only tracker a pick can have.
 *
 * It lives in its OWN module rather than inside `pool-tab.ts` (the controller's T7b ruling) because
 * its callers live in files that must not import each other. Re-measured at R4-G5 T5 with
 * `grep -rn "renderPickTracker(" packages/obsidian/src`: THREE call expressions, `PoolTab`'s
 * `grantedRow` (`components/pool-tab.ts`), `renderBoonRow`'s GRANTED arm
 * (`components/actions/boon-rows.ts`) and `renderControlGroup`
 * (`components/actions/entry-affordance.ts`), which is where `PoolTab.row` and `renderBoonRow`'s
 * SELECTED arm now reach it. The first two pass an ELEMENT; the third passes a THUNK.
 *
 * BOTH guards carry weight and each has a case that isolates it (review M-3). `!fu` alone answers
 * every pre-G4 cast fixture, whose `state` carries no such key, and a prose-`max` pick, which is
 * neither indexed nor seeded. `!res` alone answers the DESELECTED pick: `seedFeatureUses` never
 * prunes a stale `feature_uses` key, and `PoolTab.row` renders unselected candidates too, but
 * `resolveResourceIndex` walks only a pool's `selected` and `grants`, so a dropped pick has no entry
 * and draws no tracker. That is what keeps this component on the KNOWN entries without a
 * selected-or-granted gate of its own.
 *
 * R4-G5 §9.2.4 adds a SECOND way to reach the `!res` guard, and it is the cross-edition twin: a
 * `feature_uses` key written under the twin §9.2.2's collapse removed is inert and is never pruned
 * either, and it is deliberately NOT aliased (the seed re-seeds under the resolved slug at the next
 * load), so the collapsed key draws no tracker while the survivor's does. `active_buffs` IS aliased,
 * at the set in dnd5e `assembleEffectFeatures`: the two keyspaces differ on purpose.
 */
export function renderPickTracker(
  host: HTMLElement | (() => HTMLElement),
  entry: ResolvedPoolEntry,
  ctx: ComponentRenderContext,
): void {
  const fu = ctx.resolved.state.feature_uses?.[entry.slug];
  const res = ctx.resolved.resources?.get(entry.slug);
  if (!fu || !res) return;
  // R4-G5 §4.2.2 (b): the host may be a THUNK, so the `.pc-buff-group` element is created only when a
  // child actually renders. Resolving it AFTER the guard above is the whole point: resolving it before
  // would create an empty group on every candidate row that draws no tracker.
  const el = typeof host === "function" ? host() : host;
  renderResourceTracker(el, ctx, {
    id: entry.slug, name: res.name, reset: res.reset, trackClass: "pc-pick-track",
    // No POOL-BUILT entry carries `die`: `resolveResourceIndex`'s pool arm stamps
    // `{id, name, reset, maxFormula, owner}` and nothing else (measured, dnd5e `pc.resources.ts`).
    // A pick slug that COLLIDES with a feature-declared resource id is the other case: that arm skips
    // it (`if (!uses || out.has(entry.slug)) continue;`), the FEATURE's entry survives in the index,
    // and a feature entry can carry `die` · then the face renders here at the owner's level, which is
    // what §4.3.2 prescribes. So the ternary is live, not decorative; it is simply negative on every
    // pick the pool arm builds, which is why the pick fixtures, whose cast `ResolvedCharacter` carries
    // no `classes`, never reach `resourceLevelFor` and never throw.
    die: res.die,
    level: res.die ? resourceLevelFor(res.owner.source, ctx.resolved) : undefined,
    onSet: (n) => ctx.editState?.setFeatureUse(entry.slug, n),
  });
}
