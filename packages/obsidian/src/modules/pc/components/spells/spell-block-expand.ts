import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "@archivist/dnd5e/pc/pc.types";
import { renderSpellBlock } from "../../../spell/spell.renderer";

/**
 * Toggle the full spell block under `anchor`. The block is pure reference —
 * no cast/prepare controls. Mirrors inventory-row-expand's use of
 * renderItemBlock. The expand element is created synchronously so callers and
 * tests can detect the open/closed state immediately; markdown fills in async.
 */
export function toggleSpellBlock(anchor: HTMLElement, spell: ResolvedSpell, ctx: ComponentRenderContext): void {
  const existing = anchor.querySelector(":scope > .pc-spell-expand");
  if (existing) { existing.remove(); return; }
  const expand = anchor.createDiv({ cls: "pc-spell-expand" });
  void renderSpellBlock(spell.entity, ctx.app).then((block) => expand.appendChild(block));
}
