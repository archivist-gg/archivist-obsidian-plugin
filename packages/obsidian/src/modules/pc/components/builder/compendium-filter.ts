import type { Compendium } from "../../../../shared/entities/compendium-manager";
import type { RegisteredEntity } from "@archivist-gg/core";

/** Ticked-compendium set for the universal pickers. All ticked by default;
 *  unticking a compendium hides its content. Names, not editions: the
 *  compendium IS the source (parent spec §6). */
export interface CompendiumTickState {
  ticked: Set<string>;
}

export function allTicked(compendiums: Compendium[]): CompendiumTickState {
  return { ticked: new Set(compendiums.map((c) => c.name)) };
}

export function matchesTicked(entity: RegisteredEntity, state: CompendiumTickState): boolean {
  return state.ticked.has(entity.compendium);
}

/** One tick chip per compendium. Chips are re-rendered on every draw (they
 *  hold no focus); `draw` is the caller's volatile-region redraw. */
export function renderCompendiumFilter(
  parent: HTMLElement,
  compendiums: Compendium[],
  state: CompendiumTickState,
  draw: () => void,
): void {
  const grp = parent.createDiv({ cls: "pc-bfilter" });
  grp.createSpan({ cls: "pc-bfilter-label", text: "Compendium" });
  const chips = grp.createDiv({ cls: "pc-bfilter-chips" });
  for (const comp of compendiums) {
    const on = state.ticked.has(comp.name);
    const chip = chips.createSpan({ cls: `pc-bfilter-chip${on ? " on" : ""}`, text: comp.name });
    chip.addEventListener("click", () => {
      if (state.ticked.has(comp.name)) state.ticked.delete(comp.name);
      else state.ticked.add(comp.name);
      draw();
    });
  }
}

/** Colour class: homebrew compendium → green; else the entity's own edition
 *  (2024 → blue, anything else → muted grey). The Compendium type carries no
 *  edition, so colour derives from entity metadata — honest even when a
 *  compendium mixes editions. */
export function sourceTagCls(entity: RegisteredEntity): "hb" | "e2024" | "e2014" {
  if (entity.homebrew) return "hb";
  return (entity.data as { edition?: string }).edition === "2024" ? "e2024" : "e2014";
}

/** Plain coloured-text source tag; the text is always the compendium name. */
export function renderSourceTag(parent: HTMLElement, entity: RegisteredEntity): void {
  parent.createSpan({ cls: `pc-bsrc ${sourceTagCls(entity)}`, text: entity.compendium });
}
