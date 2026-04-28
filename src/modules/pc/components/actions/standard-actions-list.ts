const STANDARD_ACTIONS = [
  "Attack", "Cast a Spell", "Dash", "Disengage", "Dodge", "Grapple",
  "Help", "Hide", "Improvise", "Influence", "Magic", "Ready",
  "Search", "Shove", "Study", "Utilize",
];

export function renderStandardActionsList(parent: HTMLElement): HTMLElement {
  const block = parent.createDiv({ cls: "pc-standard-actions" });
  block.createDiv({ cls: "pc-standard-actions-title", text: "Standard combat actions" });
  block.createDiv({ cls: "pc-standard-actions-body", text: STANDARD_ACTIONS.join(", ") + "." });
  return block;
}
