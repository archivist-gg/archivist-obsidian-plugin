import type { ComponentRenderContext } from "../component.types";

const STANDARD_ACTIONS = [
  "Attack", "Cast a Spell", "Dash", "Disengage", "Dodge", "Grapple",
  "Help", "Hide", "Improvise", "Influence", "Magic", "Ready",
  "Search", "Shove", "Study", "Utilize",
];

export function renderStandardActionsList(parent: HTMLElement, ctx?: ComponentRenderContext): HTMLElement {
  const block = parent.createDiv({ cls: "pc-standard-actions" });
  block.createDiv({ cls: "pc-standard-actions-title", text: "Standard combat actions" });
  block.createDiv({ cls: "pc-standard-actions-body", text: STANDARD_ACTIONS.join(", ") + "." });
  if (ctx?.derived.conditionEffects?.actions_disabled) block.addClass("pc-row-disabled");
  return block;
}
