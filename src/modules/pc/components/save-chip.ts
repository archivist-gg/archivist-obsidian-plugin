import type { Ability } from "../../../shared/types";
import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { numberOverride } from "./edit-primitives";

/**
 * Save chip rendered beneath each ability cartouche. Reads the ability-save's
 * effective proficiency and bonus from `ctx.derived.saves[ability]`. The chip
 * has two independent override halves:
 *
 *   - Proficient: chip-level click toggles, chip-level `*` mark clears.
 *     Mark renders only when `overrides.saves[ab]?.proficient !== undefined`.
 *   - Bonus: click on `.pc-save-bn` opens an inline input (stopPropagation
 *     keeps the chip handler from firing). `*` inside `.pc-save-bn` clears
 *     just the bonus half. Mark renders when
 *     `overrides.saves[ab]?.bonus !== undefined`.
 *
 * A chip can show two marks at once when both halves are overridden — the
 * design intent is "two independent halves, two independent clears."
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
    const bonusEl = chip.createSpan({ cls: "pc-save-bn", text: formatBonus(entry.bonus) });

    const overrides = ctx.resolved.definition?.overrides?.saves;
    const profOverridden = overrides?.[ability]?.proficient !== undefined;
    const bonusOverridden = overrides?.[ability]?.bonus !== undefined;

    if (ctx.editState) {
      chip.addEventListener("click", () => ctx.editState!.toggleSaveProficient(ability));
      bonusEl.addEventListener("click", (e) => e.stopPropagation());
      numberOverride(bonusEl, {
        getEffective: () => entry.bonus,
        isOverridden: () => bonusOverridden,
        onSet: (n) => ctx.editState!.setSaveBonusOverride(ability, n),
        onClear: () => ctx.editState!.clearSaveBonusOverride(ability),
        min: -20, max: 30,
      });
    }

    if (profOverridden) {
      const mark = chip.createSpan({ cls: "archivist-override-mark", text: "*" });
      mark.setAttribute("title", "Manual proficiency override — click to remove and use the class default");
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
