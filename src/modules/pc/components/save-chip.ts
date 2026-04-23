/**
 * Renders a SAVE chip (monster prof-toggle + label + bonus) next to an ability.
 * Saves have 2 states (none / proficient); expertise is not valid for saves.
 * Read-only in SP3 — the toggle is styled but unwired.
 */
export interface SaveChipProps {
  bonus: number;
  proficient: boolean;
}

export function renderSaveChip(parent: HTMLElement, props: SaveChipProps): HTMLElement {
  const chip = parent.createDiv({ cls: `pc-save-chip${props.proficient ? " prof" : ""}` });
  chip.createSpan({ cls: `archivist-prof-toggle${props.proficient ? " proficient" : ""}` });
  chip.createEl("b", { text: "SAVE" });
  chip.createSpan({ cls: "pc-save-bn", text: formatBonus(props.bonus) });
  return chip;
}

function formatBonus(n: number): string {
  if (n < 0) return `−${Math.abs(n)}`;  // U+2212
  return `+${n}`;
}
