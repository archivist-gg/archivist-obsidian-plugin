import type { ComponentRenderContext } from "../component.types";
import type { ResolvedPoolEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { renderChargeBoxes, CHARGE_BOX_LIMIT } from "./charge-boxes";
import { renderPointPool } from "./point-pool";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "./reset-labels";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";

/**
 * The pick's OWN tracker (R4-G4 §12): `feature_uses[entry.slug]`, seeded by `seedFeatureUses` from
 * the `uses.max` the pool walk in `resolveResourceIndex` put into the resource index, drawn with the
 * T3 charge-box opts (the at-will sentinel checked first, then the `CHARGE_BOX_LIMIT` ceiling into
 * `renderPointPool`). An optional feature's `uses` never enters `resolved.features`, so this is the
 * only tracker a pick can have.
 *
 * It lives in its OWN module rather than inside `pool-tab.ts` (the controller's T7b ruling) because
 * it has TWO callers that must not import each other: `PoolTab`'s `row` and `grantedRow`
 * (`components/pool-tab.ts`) and `renderBoonRow` (`components/actions/boon-rows.ts`).
 *
 * BOTH guards carry weight and each has a case that isolates it (review M-3). `!fu` alone answers
 * every pre-G4 cast fixture, whose `state` carries no such key, and a prose-`max` pick, which is
 * neither indexed nor seeded. `!res` alone answers the DESELECTED pick: `seedFeatureUses` never
 * prunes a stale `feature_uses` key, and `PoolTab.row` renders unselected candidates too, but
 * `resolveResourceIndex` walks only a pool's `selected` and `grants`, so a dropped pick has no entry
 * and draws no tracker. That is what keeps this component on the KNOWN entries without a
 * selected-or-granted gate of its own.
 */
export function renderPickTracker(host: HTMLElement, entry: ResolvedPoolEntry, ctx: ComponentRenderContext): void {
  const fu = ctx.resolved.state.feature_uses?.[entry.slug];
  const res = ctx.resolved.resources?.get(entry.slug);
  if (!fu || !res) return;
  renderChargeBoxes(host.createSpan({ cls: "pc-feature-track pc-pick-track" }), {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), label: RESET_LABELS[res.reset] },
    // The `custom` cadence is prose on the feature itself, so the caption says only "Special" and the
    // tooltip points at that prose: the pairing every sibling tracker carries (review M-2).
    recoveryTitle: res.reset === "custom" ? CUSTOM_RESET_TIP : undefined,
    onSet: (n) => ctx.editState?.setFeatureUse(entry.slug, n),
    atWill: fu.max === AT_WILL_MAX,
    limit: CHARGE_BOX_LIMIT,
    renderLarge: (parent) => renderPointPool(parent, {
      id: entry.slug, name: res.name, used: fu.used, max: fu.max,
      resetLabel: RESET_LABELS[res.reset],
      resetTitle: res.reset === "custom" ? CUSTOM_RESET_TIP : undefined,
      onSet: (n) => ctx.editState?.setFeatureUse(entry.slug, n),
    }),
  });
}
