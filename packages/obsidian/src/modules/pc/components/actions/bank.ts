import type { ComponentRenderContext } from "../component.types";
import type { Resource, ResetTrigger } from "@archivist-gg/dnd5e/types/resource";
import { resolveScalingDie } from "@archivist-gg/dnd5e/dnd/resource-die";
import { CHARGE_BOX_LIMIT } from "./charge-boxes";
import { RESET_LABELS, CUSTOM_RESET_TIP } from "./reset-labels";
import { renderSeparated } from "../separated-caption";
import { numberField } from "../edit-primitives";

/** The note's `rendering_hint` that asks for a BANK instead of a pip row (G8 T1, brief §Design).
 *  Read as a plain string, never as a renderer switch on game vocabulary: the hint is the only
 *  thing this module knows about the feature, exactly as the Resources tab's component catalogue
 *  (`../resources/component-catalogue.ts`) reads its own. */
export const BANKED_ROLLS_HINT = "prerolled-dice";

/** THE DIE FACE MAP (ruling 4): the resolved face selects the ghost glyph, one mask var per face.
 *  The art is the Michelle Lukezic set (CC-BY 3.0, CREDITS.md), carried in
 *  `modules/pc/styles/bank-dice.css` as `--pc-bank-die-d4` .. `--pc-bank-die-d20`.
 *
 *  It doubles as the GATE's membership test, which is why it holds the var EXPRESSION rather than
 *  being a bare face list with the name built by template: a face with no art (d100, a homebrew
 *  `d3`, a malformed `die.base`) has no own property here, so it cannot reach a slot that would
 *  draw an empty 28px hole, and the resource falls back to the shipped pip tracker. Looked up as an
 *  OWN property (the `RENDERING_HINT_LAYOUT` guard convention in dnd5e's `pool-layout.ts`): the
 *  face comes from free-form note data, and a plain index would answer `constructor` with a
 *  function off the prototype. */
const BANK_DIE_MASKS: Readonly<Record<string, string>> = {
  d4: "var(--pc-bank-die-d4)",
  d6: "var(--pc-bank-die-d6)",
  d8: "var(--pc-bank-die-d8)",
  d10: "var(--pc-bank-die-d10)",
  d12: "var(--pc-bank-die-d12)",
  d20: "var(--pc-bank-die-d20)",
};

/** The v7 tooltips, verbatim from the approved companion's DOM. */
const LIVE_TIP = "Click to edit";
const SPENT_TIP = "Spent — click to edit; click the box to restore";
const ENTRY_TIP = "Click to type a roll made by hand";

/** A banked resource's die, resolved once: the label the row prints, the face the map is keyed on,
 *  and that face's own count of sides. */
export interface BankedDie {
  /** The face VERBATIM from the data, for `.pc-resource-die` (`1d20` stays `1d20`, R4-G5 §4.3.1). */
  label: string;
  /** The NORMALISED face (`d20`), which keys {@link BANK_DIE_MASKS} and counts the Roll pill. */
  face: string;
  /** The face's sides (20 for a d20): the inline editor's ceiling, so a typo cannot bank a roll the
   *  die cannot make. `setFeatureRolls` still sanitises to 1..999 on the way to state. */
  sides: number;
}

/**
 * THE GATE (G8 T1, brief §REMAINING): a resource banks its rolls when the note asks for the bank
 * AND the resource declares a `die` whose resolved face has art. Returns the resolved die, or
 * `undefined` for every other resource on the sheet, which keeps the shipped tracker.
 *
 * `featureHint` is the FEATURE-level `rendering_hint` (dnd5e `Feature.rendering_hint`), which is the
 * surface the vault note actually sets on Portent (brief T5) and the one the renderer can read: the
 * resource index's `ResolvedResource.renderingHint` carries the RESOURCE-level hint
 * (`resolveFeatureResources` copies `r.rendering_hint`), a different key that the same note may
 * leave unset. Either carrier opens the gate, feature level first, so a converter that eventually
 * emits the hint on the resource needs no second gate here.
 */
export function bankedDieFor(
  featureHint: string | undefined,
  resource: Resource | undefined,
  level: number,
): BankedDie | undefined {
  if (!resource?.die) return undefined;
  if (featureHint !== BANKED_ROLLS_HINT && resource.rendering_hint !== BANKED_ROLLS_HINT) return undefined;
  const label = resolveScalingDie(resource.die, level);
  // `1d8` and `d8` are the same face to the map: the corpus spells both (R4-G5 §4.3.1 pins the
  // LABEL as verbatim, so the normalisation lives here and never reaches the printed span).
  const face = /d\d+/.exec(label)?.[0];
  if (!face || !Object.prototype.hasOwnProperty.call(BANK_DIE_MASKS, face)) return undefined;
  return { label, face, sides: Number(face.slice(1)) };
}

export interface FeatureBankOpts {
  /** The `feature_uses` AND `feature_rolls` key (the same id, brief §Design). */
  id: string;
  /** The resource's display name. The row names the feature elsewhere, so this reaches the DOM only
   *  as the ghost slot's `aria-label`, which has no text of its own to be read out. */
  name: string;
  reset: ResetTrigger;
  die: BankedDie;
}

/**
 * THE BANK (G8 T4; the v7 model, `docs/design/portent-banked-variants-v7/index.html`) · the tracker
 * a `prerolled-dice` resource draws instead of a pip row, in the SAME detail slot and the same
 * sibling order the shipped tracker uses: the die label, the Roll pill, the bank, the recovery
 * caption.
 *
 * THREE WIDGETS, THREE VERBS (v7 §PROPOSED, rulings 1-4 and 7):
 * - the NUMBER (`.pc-bank-val`) is the value · click edits it through the shipped `numberField`,
 *   and the whole bank is written back with that index replaced;
 * - the BOX (`.archivist-toggle-box`, the shipped pip re-homed under its number) is usage · one per
 *   BANKED value, never per empty slot, because `spendFeatureRoll` refuses a box with no number
 *   above it. Pairing is positional: value `i` sits above box `i`, both spent iff `i < used`;
 * - the GHOST DIE (`.pc-bank-entry`) is an empty slot · click types a roll made by hand.
 *
 * The COUNT axis is untouched: `feature_uses[id].used` stays the single usage truth and the spent
 * BOUNDARY, so this component never writes a use directly. It writes only through the three bank
 * primitives on `CharacterEditState` (`setFeatureRolls`, `spendFeatureRoll`, `restoreFeatureRoll`),
 * each of which owns the `used <= bank.length` invariant. The boxes are built here rather than
 * through `renderChargeBoxes`, whose one row fills FROM THE LEFT on a click: the bank's boxes
 * address a slot each, which is what positional pairing means.
 *
 * THE ROLL PILL wears the shipped spend-control dress (`.pc-spend > button.pc-spend-control`) and
 * fills every EMPTY slot, keeping the values already banked (ruling 6). The rolls are generated
 * HERE, uniformly over the die's own faces: the plugin's only dice integration is
 * `rollDiceWithRender` (`shared/rendering/renderer-utils.ts`), which hands a notation to the Dice
 * Roller plugin's renderer and resolves `void`, so it can animate a roll but cannot report the N
 * individual faces a bank needs, and it needs a plugin that may not be installed. A local uniform
 * draw is therefore the honest minimum, and it is the only randomness in this module.
 *
 * Returns false WITHOUT rendering when the resource is not owned (no `feature_uses` entry, the
 * ownership rule every tracker follows) or when its max clears `CHARGE_BOX_LIMIT` (which includes
 * the `AT_WILL_MAX` sentinel, 999): a bank of 13+ columns is the numeric widget's case, not this
 * one. Both callers then fall through to `renderResourceTracker`, so no row loses its tracker.
 */
export function renderFeatureBank(
  host: HTMLElement,
  ctx: ComponentRenderContext,
  opts: FeatureBankOpts,
): boolean {
  const fu = ctx.resolved.state.feature_uses?.[opts.id];
  if (!fu || fu.max < 1 || fu.max > CHARGE_BOX_LIMIT) return false;
  const bank = ctx.resolved.state.feature_rolls?.[opts.id] ?? [];
  const editState = ctx.editState;

  host.createSpan({ cls: "pc-resource-die", text: opts.die.label });

  const spend = host.createDiv({ cls: "pc-spend" });
  const pill = spend.createEl("button", { cls: "pc-spend-control", text: `Roll ${fu.max}${opts.die.face}` });
  // SIGN encoding: the LIVE rolls are the positive ones, so the pill is full when the live count
  // reaches the max · spent slots still hold their (negative) numbers and are NOT empty. A missing
  // `editState` does NOT disable it, which is the shipped spend control's rule (`renderFixedSpend`):
  // the click no-ops through the optional call instead.
  pill.disabled = bank.filter((v) => v > 0).length >= fu.max;
  pill.addEventListener("click", (e) => {
    e.stopPropagation();
    // The Roll pill RE-ROLLS the live part of the day's bank: spent slots keep their record
    // (`setFeatureRolls` banks positive and resets the count), and only the live tail is replaced,
    // so a mid-day re-roll never erases what was already spent.
    const live = bank.filter((v) => v > 0);
    while (live.length < fu.max) live.push(1 + Math.floor(Math.random() * opts.die.sides));
    editState?.setFeatureRolls(opts.id, live);
  });
  // One column per slot. A bank LONGER than its max still shows every value (a max that dropped
  // under a live bank, e.g. a level or override change, must not hide rolls the day still has), and
  // those extra columns carry no box: the sign cannot mark them spent.
  const wrap = host.createSpan({ cls: "pc-bank" });
  const columns = Math.max(bank.length, fu.max);
  for (let i = 0; i < columns; i++) {
    if (i >= bank.length) {
      renderGhost(wrap, opts, bank, editState);
      continue;
    }
    // SIGN IS STATE (the shuffle fix): a SPENT roll is its NEGATIVE, so the per-slot truth is the
    // SIGN, never `i < fu.used` · a hand-edited file can leave the count and the signs out of step
    // and the slot must still draw what its own value says.
    const spent = bank[i] < 0;
    const slot = wrap.createSpan({ cls: spent ? "pc-bank-slot pc-bank-slot-spent" : "pc-bank-slot" });
    // `pc-bank-input` dresses the INPUT, not this span: `makeInlineInput` copies the value
    // element's classes onto the input it swaps in (edit-primitives.ts, Bug A), so the v7 class
    // travels with the swap and its rules bind on `input.pc-bank-input`.
    const val = slot.createSpan({ cls: "pc-bank-val pc-bank-input", text: String(Math.abs(bank[i])) });
    val.setAttribute("title", spent ? SPENT_TIP : LIVE_TIP);
    if (editState) {
      numberField(val, {
        getValue: () => Math.abs(bank[i]),
        // An edit keeps the slot's SIGN (a spent number corrected in place stays spent; correcting
        // a spent roll is fixing the record, not un-spending it) and every other value's.
        onSet: (n) => editState.setFeatureRolls(opts.id, bank.map((v, j) => (j === i ? Math.sign(v) * Math.abs(n) : v))),
        min: 1,
        max: opts.die.sides,
      });
    }
    if (i >= fu.max) continue;
    const box = slot.createSpan({ cls: "archivist-toggle-box-row" })
      .createSpan({ cls: spent ? "archivist-toggle-box archivist-toggle-box-checked" : "archivist-toggle-box" });
    if (!editState) continue;
    box.addEventListener("click", (e) => {
      e.stopPropagation();
      // No optimistic repaint (the one thing `renderChargeBoxes` does that this cannot): the sign
      // is per-slot state a re-render must reconcile, so painting the clicked box before the write
      // would race the writer. Each writer re-renders.
      if (spent) editState.restoreFeatureRoll(opts.id, i);
      else editState.spendFeatureRoll(opts.id, i);
    });
  }

  // The `/ Long Rest` caption stays (ruling 6): the bank replaces the PIPS, not the recovery line.
  // Printed the way `renderResourceControl` prints it beside a control that draws no boxes
  // (`../resources/resource-controls.ts`): one clipping unit whose `/ ` separator sits out of flow.
  const cap = host.createSpan({ cls: "pc-feature-track" }).createSpan({ cls: "pc-charge-boxes" });
  const [unit] = renderSeparated(cap, [RESET_LABELS[opts.reset]], { sep: "/", leading: true, spaces: false, unitCls: "pc-charge-recovery" });
  if (opts.reset === "custom") unit.setAttribute("title", CUSTOM_RESET_TIP);
  return true;
}

/** An empty slot (ruling 4): the mapped ghost face, click-to-type. The typed value lands at the
 *  FIRST empty position rather than at this ghost's own index · `feature_rolls` is a dense
 *  `number[]` (dnd5e `characterStateSchema.feature_rolls`) and a hole would break the positional
 *  pairing `used` depends on, so clicking the second of two ghosts fills the first. */
function renderGhost(
  wrap: HTMLElement,
  opts: FeatureBankOpts,
  bank: readonly number[],
  editState: ComponentRenderContext["editState"],
): void {
  const entry = wrap.createSpan({ cls: "pc-bank-entry pc-bank-input" });
  entry.setAttribute("title", ENTRY_TIP);
  entry.setAttribute("aria-label", opts.name);
  entry.createSpan({ cls: "pc-bank-entry-glyph" })
    .style.setProperty("--pc-bank-die-mask", BANK_DIE_MASKS[opts.die.face]);
  if (!editState) return;
  numberField(entry, {
    // The die's MINIMUM seeds the field, so the pre-selected value is a legal roll: Enter is
    // explicit intent in `makeInlineInput` and commits whatever is there, and a 0 seed would only
    // clamp back up to 1 anyway.
    getValue: () => 1,
    onSet: (n) => editState.setFeatureRolls(opts.id, [...bank, n]),
    min: 1,
    max: opts.die.sides,
  });
}
