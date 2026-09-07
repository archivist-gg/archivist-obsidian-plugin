import type { ComponentRenderContext } from "../component.types";
import type { ResetTrigger, ResourceDie } from "@archivist-gg/dnd5e/types/resource";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { AT_WILL_MAX } from "@archivist-gg/dnd5e/dnd/resource-formula";
import { renderChargeBoxes, CHARGE_BOX_LIMIT } from "./charge-boxes";
import { renderPointPool } from "./point-pool";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "./reset-labels";

export interface ResourceTrackerOpts {
  /** The `feature_uses` key AND the numeric widget's id. */
  id: string;
  /** Display name for the numeric widget's own `.pc-point-pool-name`. This function NEVER prints a
   *  name span of its own, which is the operative rule: the four callers split TWO and TWO. TWO print
   *  one themselves, each in its own vocabulary · `renderCardResource` (`.pc-card-resource-name`,
   *  always) and `renderPoolHead` (`.pc-pool-head-name`, on its `!numeric` paths only, so that the
   *  name is printed exactly once when `renderPointPool` takes over). TWO deliberately print none ·
   *  `renderFirstResourceTracker` and `renderPickTracker`, because every row that hosts them already
   *  names the thing elsewhere in the row (the feature row's `.pc-action-row-name`, the race block's
   *  trait row, the pool / granted / boon rows' own name cells). `name` still travels for both, since
   *  the numeric widget prints it if the max clears `CHARGE_BOX_LIMIT`. */
  name: string;
  reset: ResetTrigger;
  /** When present, the die face is printed on the HOST, BEFORE the track (the shipped sibling order
   *  at `renderCardResource` and `renderPoolHead`), resolved at `level`. */
  die?: ResourceDie;
  /** The level `die` is resolved at: the OWNER's class level (R4-G4 §6.2.4). All FOUR shipped callers
   *  pass it inside the same ternary that decides `die`, so the two are always supplied together and
   *  `resourceLevelFor` is never called for a die-less resource · which matters, because it walks
   *  `resolved.classes` unguarded and several fixtures cast a `ResolvedCharacter` without one.
   *  A `die` supplied WITHOUT a `level` therefore reaches no shipped path; it degrades to the
   *  character's TOTAL level, which for a multiclass owner is the wrong face (mutant t4-m19b measures
   *  exactly that: a Bard 5 / Fighter 5 reads the total-10 face `d10` instead of `d8`). The pairing is
   *  the caller's contract, not something this signature can enforce. */
  level?: number;
  /** Extra class on the `.pc-feature-track` wrapper (the pick site adds `pc-pick-track`). */
  trackClass?: string;
  /** Atomic writer. The pick and pool-head sites pass it; the two feature sites pass the delta pair
   *  below instead, because `tests/pc-race-block-tracker.test.ts` pins `expendFeatureUse` called once
   *  at `renderFirstResourceTracker`'s site. BOTH shapes are kept deliberately (R4-G5 §4.3.2): the
   *  extraction is a refactor with no behavioural surface, and unifying on `onSet` (which would also
   *  cut N re-renders to one, since `pc.edit-state.ts` calls `onChange` inside each writer) is booked
   *  as its own row, not smuggled in here. */
  onSet?: (newUsed: number) => void;
  onExpend?: () => void;
  onRestore?: () => void;
}

/**
 * The ONE feature-resource tracker (R4-G5 §4.3.2; the G4 T12 park M-8 at its fifth site).
 *
 * It owns, once: the `feature_uses[id]` read and its gate, the `.pc-feature-track` span, the
 * `RESET_LABELS` caption, the `custom` tooltip, the at-will sentinel, the `CHARGE_BOX_LIMIT` ceiling
 * and the `renderPointPool` fallback. It replaces the tails of `renderCardResource` and
 * `renderFirstResourceTracker` (`./feature-rows`), `renderPickTracker` (`./pick-tracker`) and
 * `renderPoolHead`'s DICE branch (`../pool-tab`), which differed in the SIX axes `ResourceTrackerOpts`
 * spreads over NINE opts (four axes are one opt; the die face travels with its `level`, and the writer
 * axis is `onSet` OR the `onExpend` / `onRestore` pair): the `feature_uses` id, the display name, the
 * `ResetTrigger` source, the writer shape (`onSet` at the pick and pool-head tails, the `onExpend` /
 * `onRestore` pair at the two feature tails), the track's extra class (`pc-pick-track`, the pick tail
 * alone) and the die face with the level it resolves at (`renderCardResource` and `renderPoolHead`
 * printed one; `renderPickTracker` and `renderFirstResourceTracker` did not, and R4-G5 §4.3.1 is
 * exactly the decision to give the second of those two a face).
 *
 * It does NOT reach the other three `renderChargeBoxes` callers: `items-table.ts` speaks the persisted
 * ITEM charge vocabulary (`{amount, reset: "dawn"|"short"|"long"|"special"}` and `setItemCharges`), and
 * `cast-view.ts` x2 pass a bare `{used, max, onExpend, onRestore}` with no resource identity at all.
 *
 * The `resources` index lookup and its `!res` guard stay in the two callers that have one
 * (`renderPickTracker`, `renderPoolHead`), so no tail gains or loses a guard it has today. Returns
 * whether a tracker was rendered: `renderFirstResourceTracker`'s boolean has two consumers (the attack
 * note's placement, in-row versus card) and is passed straight through.
 */
export function renderResourceTracker(
  host: HTMLElement,
  ctx: ComponentRenderContext,
  opts: ResourceTrackerOpts,
): boolean {
  const fu = ctx.resolved.state.feature_uses?.[opts.id];
  if (!fu) return false;
  const resetLabel = RESET_LABELS[opts.reset];
  const resetTitle = opts.reset === "custom" ? CUSTOM_RESET_TIP : undefined;
  if (opts.die) {
    host.createSpan({ cls: "pc-resource-die", text: resolveScalingDie(opts.die, opts.level ?? ctx.resolved.totalLevel) });
  }
  const track = host.createSpan({ cls: opts.trackClass ? `pc-feature-track ${opts.trackClass}` : "pc-feature-track" });
  renderChargeBoxes(track, {
    used: fu.used,
    max: fu.max,
    recovery: { amount: String(fu.max), label: resetLabel },
    recoveryTitle: resetTitle,
    onSet: opts.onSet,
    onExpend: opts.onExpend,
    onRestore: opts.onRestore,
    atWill: fu.max === AT_WILL_MAX,
    limit: CHARGE_BOX_LIMIT,
    renderLarge: (parent) => renderPointPool(parent, {
      id: opts.id, name: opts.name, used: fu.used, max: fu.max, resetLabel, resetTitle,
      // The numeric path always writes ATOMICALLY, even where the boxes use the delta pair: a stepper
      // has no per-click delta to emit, and that is what all four shipped tails already did.
      onSet: (n) => (opts.onSet ? opts.onSet(n) : ctx.editState?.setFeatureUse(opts.id, n)),
    }),
  });
  return true;
}
