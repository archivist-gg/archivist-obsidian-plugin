import { setTooltip } from "obsidian";

/**
 * The tag's CSS-CLASS key, not its display string (R4-G3a §5.2).
 *
 * Until G3a the kind WAS the text: `ConditionTagKind` was `"DIS" | "ADV" | "AUTO-FAIL"` and the
 * primitive rendered `text: kind`. That collapsed two concerns into one union, so a fourth tag
 * text could not exist without inventing a fourth colour, and the three chip surfaces each grew
 * their own `mode === "advantage" ? "ADV" : "DIS"` ternary: a vocabulary switch on game data
 * inside a component (invariant 3), which rendered "DIS" for a `reroll` the moment the engine's
 * `mode` widened.
 *
 * Now `kindClass` routes COLOUR only and `text` is passed in, sourced from dnd5e's label tables
 * (`ROLL_MODE_TAG`, `AUTO_FAIL_TAG`, `saveOutcomeTag`). `rider` is the neutral colour for the
 * non-advantage/disadvantage modes (`reroll`, `add-d4`); `outcome` is the save-outcome rail.
 */
export type ConditionTagKind = "adv" | "dis" | "fail" | "rider" | "outcome";

const KIND_CLASS: Record<ConditionTagKind, string> = {
  adv: "pc-cond-tag-adv",
  dis: "pc-cond-tag-dis",
  fail: "pc-cond-tag-fail",
  rider: "pc-cond-tag-rider",
  outcome: "pc-cond-tag-outcome",
};

/**
 * Render a small condition tag chip ("ADV" / "DIS" / "RR" / "+D4" / "AUTO-FAIL" / "0/½") with a
 * tooltip explaining the source. Used by save-chip, skills-panel, and the actions tables. Tags
 * are decorative: they have no click handler.
 */
export function renderConditionTag(
  parent: HTMLElement,
  kindClass: ConditionTagKind,
  text: string,
  tooltip: string,
): HTMLElement {
  const el = parent.createSpan({
    cls: `pc-meta-chip pc-cond-tag ${KIND_CLASS[kindClass]}`,
    text,
  });
  if (tooltip) setTooltip(el, tooltip);
  return el;
}
