import { setTooltip } from "obsidian";
import type { Ability } from "@archivist-gg/dnd5e";
import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { renderConditionTag } from "./condition-tag";
import { numberOverride } from "./edit-primitives";
import { attachStatTooltip } from "./stat-tooltip";
import { renderSituationalRows } from "./situational-rows";

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

    // Situational saving-throw bonuses (e.g. conditional item boosts) surface in
    // a hover popover. Saves render as per-ability chips with no single "all
    // saves" container, so the global savesInformational slice attaches to each
    // chip. Coexists with the per-chip exhaustion setTooltip on bonusEl below.
    const savesInfo = ctx.derived.savesInformational ?? [];
    if (savesInfo.length > 0) {
      attachStatTooltip(chip, (host) => {
        host.createDiv({ cls: "pc-stat-tooltip-title", text: "Saves — situational" });
        renderSituationalRows(host, savesInfo);
      });
    }

    const ce = ctx.derived.conditionEffects;
    if (ce) {
      const isStr = ability === "str";
      const isDex = ability === "dex";
      const autofail = (isStr && ce.save_autofail_str) || (isDex && ce.save_autofail_dex);
      const dis = !autofail && (ce.saves_disadvantage_all || (isDex && ce.save_disadvantage_dex));

      if (autofail) {
        bonusEl.classList.add("is-hidden");
        const sources = ce.sources
          .filter((s) => {
            const slug = s.condition;
            return slug === "paralyzed" || slug === "petrified" || slug === "stunned" || slug === "unconscious";
          })
          .map((s) => s.condition);
        renderConditionTag(chip, "AUTO-FAIL", `Auto-fail from ${sources.join(", ") || "condition"}`);
      } else if (dis) {
        const sources = ce.sources
          .filter((s) => {
            if (s.condition === "exhaustion") return ce.saves_disadvantage_all;
            if (s.condition === "restrained") return isDex; // only DEX saves
            return false;
          })
          .map((s) => s.condition === "exhaustion" ? `exhaustion ${s.level}` : s.condition);
        renderConditionTag(chip, "DIS", `Disadvantage from ${sources.join(", ")}`);
      }

      if (ce.d20_test_penalty !== 0 && !autofail) {
        const baseBonus = entry.bonus - ce.d20_test_penalty;
        setTooltip(
          bonusEl,
          `${formatBonus(baseBonus)} base ${ce.d20_test_penalty < 0 ? "−" : "+"} ${Math.abs(ce.d20_test_penalty)} from exhaustion = ${formatBonus(entry.bonus)}`,
        );
      }
    }

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
          const win = (mark.ownerDocument ?? activeDocument).defaultView ?? activeWindow;
          if (win.confirm("Clear the save proficiency override and revert to the class default?")) {
            ctx.editState!.clearSaveProficientOverride(ability);
          }
        });
      }
    }
  }
}

function formatBonus(n: number): string {
  if (n < 0) return `−${Math.abs(n)}`;   // U+2212
  return `+${n}`;
}
