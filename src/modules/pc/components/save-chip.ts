import type { Ability } from "../../../shared/types";
import type { SheetComponent, ComponentRenderContext } from "./component.types";

/**
 * Save chip rendered beneath each ability cartouche. Reads the ability-save's
 * effective proficiency from `ctx.derived.saves[ability]`, and shows an
 * `archivist-override-mark` `*` when an explicit override exists in
 * `definition.overrides.saves[ability]`. Click toggles the override via the
 * edit state; clicking the mark clears it.
 */
export class SaveChip implements SheetComponent {
  readonly type: string;

  constructor(private readonly ability: Ability) {
    this.type = `save-chip-${ability}`;
  }

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const ability = this.ability;
    const entry = ctx.derived.saves[ability];
    if (!entry) return;

    const chip = el.createDiv({ cls: `pc-save-chip${entry.proficient ? " prof" : ""}` });
    chip.createSpan({ cls: `archivist-prof-toggle${entry.proficient ? " proficient" : ""}` });
    chip.createEl("b", { text: "SAVE" });
    chip.createSpan({ cls: "pc-save-bn", text: formatBonus(entry.bonus) });

    const overrides = ctx.resolved.definition.overrides?.saves;
    const hasOverride = overrides && overrides[ability] !== undefined;

    if (ctx.editState) {
      chip.addEventListener("click", () => ctx.editState!.toggleSaveProficient(ability));
    }

    if (hasOverride) {
      const mark = chip.createSpan({ cls: "archivist-override-mark", text: "*" });
      mark.setAttribute("title", "Manual override — click to remove and use the class default");
      if (ctx.editState) {
        mark.addEventListener("click", (e) => {
          e.stopPropagation();
          ctx.editState!.clearSaveProficientOverride(ability);
        });
      }
    }
  }
}

function formatBonus(n: number): string {
  if (n < 0) return `−${Math.abs(n)}`;   // U+2212
  return `+${n}`;
}
