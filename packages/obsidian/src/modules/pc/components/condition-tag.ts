import { setTooltip } from "obsidian";
import type { RollModifierEntry, RollModifierMode, SaveOutcomeEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { CONDITIONAL_TAG_MARK, OUTCOME, ROLL_MODE_TAG, saveOutcomeTag } from "@archivist-gg/dnd5e/pc/roll-tag-labels";
import { normalizeRollScope } from "@archivist-gg/dnd5e/pc/roll-scope";

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
 * Engine `mode` to tag COLOUR (spec §6.2.2). A `Record<RollModifierMode, ConditionTagKind>`, not
 * a ternary at each of the three chip surfaces: the TEXT half of the render decision already gets
 * a compile guard from dnd5e's `Record<RollModifierMode, string>` label tables, and the CLASS half
 * must get the same one. Spelled as a ternary, a FIFTH `mode` member would silently route to
 * "rider" and ship a wrong colour with a green tree; spelled as this Record, it is a tsc error
 * here (the same control as §14 row 8i, one layer up).
 *
 * `reroll` and `add-d4` share `rider` deliberately: they change HOW you roll rather than whether
 * the roll is better or worse, so neither the advantage nor the disadvantage colour reads right.
 */
export const MODE_CLASS: Record<RollModifierMode, ConditionTagKind> = {
  advantage: "adv",
  disadvantage: "dis",
  reroll: "rider",
  "add-d4": "rider",
};

/**
 * Render a small condition tag chip ("ADV" / "DIS" / "RR" / "+D4" / "AUTO-FAIL" / "0/½") with a
 * tooltip explaining the source. Used by save-chip, skills-panel, and the actions tables. Tags
 * are decorative: they have no click handler. `conditional` adds `pc-cond-tag-conditional` (R4-G7 T8 RIDER-20); the three
 * carriers reach this through `renderConditionTags`, which merges same-text tags first.
 */
export function renderConditionTag(
  parent: HTMLElement,
  kindClass: ConditionTagKind,
  text: string,
  tooltip: string,
  conditional = false,
): HTMLElement {
  const el = parent.createSpan({
    cls: `pc-meta-chip pc-cond-tag ${KIND_CLASS[kindClass]}${conditional ? " pc-cond-tag-conditional" : ""}`,
    text,
  });
  if (tooltip) setTooltip(el, tooltip);
  return el;
}

/** One tag a carrier wants on its rail, before same-text tags merge (R4-G7 T8 RIDER-20). */
export interface ConditionTagSpec {
  kindClass: ConditionTagKind;
  text: string;
  /** One tooltip LINE: this source's label and qualifier. */
  tooltip: string;
  conditional?: boolean;
}

/**
 * R4-G7 T8 RIDER-20 (F-ADV (a)) · a `roll-modifier` entry as a tag. It is CONDITIONAL when it carries a `condition`, or a
 * `scope` that dnd5e's `normalizeRollScope` does not map: the fold keeps a canonical scope (a skill slug or an ability key,
 * each of which maps to itself) or passes the converter's prose through RAW, so an unmapped scope IS the qualifier ("your
 * next attack roll on the current turn"). A conditional tag prints the `ROLL_MODE_TAG` word followed by dnd5e's
 * `CONDITIONAL_TAG_MARK`; the tooltip keeps the label and the qualifier text (scope first, then condition). An unconditional,
 * mapped entry is byte-identical to the pre-rider tag.
 */
export function rollModifierTagSpec(rm: RollModifierEntry): ConditionTagSpec {
  const rawScope = rm.scope && normalizeRollScope(rm.scope, rm.roll) === undefined ? rm.scope : undefined;
  const qualifiers = [rawScope, rm.condition].filter((s): s is string => !!s);
  const conditional = qualifiers.length > 0;
  return {
    kindClass: MODE_CLASS[rm.mode],
    text: conditional ? `${ROLL_MODE_TAG[rm.mode]}${CONDITIONAL_TAG_MARK}` : ROLL_MODE_TAG[rm.mode],
    tooltip: conditional ? `${rm.label}: ${qualifiers.join("; ")}` : rm.label,
    conditional,
  };
}

/** R4-G7 T8 RIDER-20 · a `save-outcome` entry as a tag (R4-G3a §5.3's text and tooltip), CONDITIONAL when it carries a
 *  `condition`, which the tooltip now names after the `appliesTo` part. */
export function saveOutcomeTagSpec(e: SaveOutcomeEntry): ConditionTagSpec {
  const text = saveOutcomeTag(e.on_success, e.on_failure);
  const tail = [e.appliesTo, e.condition].filter((s): s is string => !!s).map((s) => ` · ${s}`).join("");
  return {
    kindClass: "outcome",
    text: e.condition ? `${text}${CONDITIONAL_TAG_MARK}` : text,
    tooltip: `${e.label}: on a success ${OUTCOME[e.on_success]}, on a failure ${OUTCOME[e.on_failure]}${tail}`,
    conditional: !!e.condition,
  };
}

/**
 * R4-G7 T8 RIDER-20 (F-ADV (b)) · render ONE carrier's tags (a save chip's rail, a skill row, a HIT cell), merging every
 * spec with the SAME rendered text into one tag at its first position. The merged tooltip lists each source's line once,
 * one per line: distinct sources are never dropped, and an identical line (the folded Indomitable's three copies carry
 * the same label and no qualifier) is one source said three times. No engine dedupe is involved: the entries stay separate
 * grants in `derived.rollModifiers`; only the rail stops painting indistinguishable copies.
 * `host` is a function so a carrier that creates its rail lazily (the save chip) still adds no empty element.
 */
export function renderConditionTags(host: () => HTMLElement, specs: readonly ConditionTagSpec[]): void {
  const byText = new Map<string, { spec: ConditionTagSpec; lines: string[] }>();
  for (const spec of specs) {
    const seen = byText.get(spec.text);
    if (!seen) { byText.set(spec.text, { spec, lines: spec.tooltip ? [spec.tooltip] : [] }); continue; }
    if (spec.tooltip && !seen.lines.includes(spec.tooltip)) seen.lines.push(spec.tooltip);
  }
  for (const { spec, lines } of byText.values()) {
    renderConditionTag(host(), spec.kindClass, spec.text, lines.join("\n"), spec.conditional);
  }
}
