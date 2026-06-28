import type { MonsterEditState } from "../monster.edit-state";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { formatModifier, savingThrow } from "../../../shared/dnd/math";
import { wireOverride } from "../../../shared/edit/override-system";
import { createCollapsible } from "../../../shared/edit/collapsible";
import { type DomRefs, getAbilityScore, updateSaveToggle } from "./types";

/**
 * Renders the collapsible Saving Throws section: six rows (one per
 * ability) with a proficiency toggle, the auto-calculated value
 * (click to override), and the override asterisk if already
 * overridden.
 */
export function renderSaves(
  block: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): void {
  const savesSection = block.createDiv({ cls: "property-block" });
  const { grid: savesGrid } = createCollapsible(savesSection, "Saving Throws", false);
  savesGrid.addClass("archivist-saves-grid");
  refs.savesGrid = savesGrid;

  for (const key of ABILITY_KEYS) {
    const item = savesGrid.createDiv({ cls: "archivist-save-item" });

    const toggle = item.createDiv({ cls: "archivist-prof-toggle" });
    if (state.current.saveProficiencies[key]) toggle.addClass("proficient");
    toggle.addEventListener("click", () => {
      state.toggleSaveProficiency(key);
      updateSaveToggle(toggle, state.current.saveProficiencies[key]);
    });
    refs.saveToggles[key] = toggle;

    item.createEl("span", { cls: "archivist-save-ability", text: ABILITY_NAMES[key] });

    const valEl = item.createEl("span", { cls: "archivist-auto-value" });
    const score = getAbilityScore(state.current, key);
    const profBonus = state.current.proficiencyBonus;
    const saveIsOverridden = state.current.overrides.has(`saves.${key}`);
    const saveVal = saveIsOverridden && state.current.saves?.[key] !== undefined
      ? state.current.saves[key]
      : savingThrow(score, state.current.saveProficiencies[key], profBonus);
    valEl.textContent = formatModifier(saveVal);
    if (state.current.saveProficiencies[key]) valEl.addClass("proficient-value");
    refs.saveValues[key] = valEl;

    const saveAutoLabel = item.createEl("span", { cls: "archivist-auto-label" });
    wireOverride(valEl, saveAutoLabel, `saves.${key}`,
      () => {
        const sc = getAbilityScore(state.current, key);
        return savingThrow(sc, state.current.saveProficiencies[key], state.current.proficiencyBonus);
      },
      (val) => {
        if (!state.current.saves) state.current.saves = {};
        state.current.saves[key] = val;
        state.setOverride(`saves.${key}`, val);
      },
      () => {
        state.clearOverride(`saves.${key}`);
      },
      formatModifier,
      saveIsOverridden,
    );
  }
}
