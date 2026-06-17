import { setIcon } from "obsidian";

export interface ActiveEffectItem {
  /** Microcap label, e.g. "Concentration" / "Active boon". */
  label: string;
  /** The effect's display name. */
  name: string;
  /** Optional Lucide icon id (rendered via setIcon). */
  icon?: string;
  /** Invoked when the user clicks the tile's end (✕) button. */
  onEnd: () => void;
}

/** Generic "currently active" rail: one framed pc-panel tile per item, each with
 *  an end (✕) control. Renders nothing when there are no items. Reused by the
 *  Spells tab (concentration) and pool tabs (active boons) — it knows nothing
 *  about either domain. */
export function renderActiveEffectsRail(parent: HTMLElement, items: ActiveEffectItem[]): void {
  if (items.length === 0) return;
  const rail = parent.createDiv({ cls: "pc-ae-rail" });
  for (const item of items) {
    const tile = rail.createDiv({ cls: "pc-panel pc-ae-tile" });
    if (item.icon) {
      const ico = tile.createSpan({ cls: "pc-ae-icon" });
      setIcon(ico, item.icon);
    }
    const text = tile.createDiv({ cls: "pc-ae-text" });
    text.createSpan({ cls: "pc-ae-label", text: item.label });
    text.createSpan({ cls: "pc-ae-name", text: item.name });
    const end = tile.createEl("button", {
      cls: "pc-ae-end",
      text: "✕",
      attr: { "aria-label": `End ${item.name}`, title: `End ${item.name}` },
    });
    end.addEventListener("click", () => item.onEnd());
  }
}
