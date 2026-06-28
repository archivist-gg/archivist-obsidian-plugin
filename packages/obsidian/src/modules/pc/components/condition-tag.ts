import { setTooltip } from "obsidian";

export type ConditionTagKind = "DIS" | "ADV" | "AUTO-FAIL";

const KIND_CLASS: Record<ConditionTagKind, string> = {
  "DIS": "pc-cond-tag-dis",
  "ADV": "pc-cond-tag-adv",
  "AUTO-FAIL": "pc-cond-tag-fail",
};

/**
 * Render a small condition tag chip ("DIS" / "ADV" / "AUTO-FAIL") with a
 * tooltip explaining the source. Used by save-chip, skills-panel, and the
 * actions tables. Tags are decorative — they have no click handler.
 */
export function renderConditionTag(
  parent: HTMLElement,
  kind: ConditionTagKind,
  tooltip: string,
): HTMLElement {
  const el = parent.createSpan({
    cls: `pc-cond-tag ${KIND_CLASS[kind]}`,
    text: kind,
  });
  if (tooltip) setTooltip(el, tooltip);
  return el;
}
