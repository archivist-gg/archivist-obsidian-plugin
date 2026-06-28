import type { MonsterEditState } from "../monster.edit-state";
import { ABILITY_KEYS, ABILITY_NAMES } from "../../../shared/dnd/constants";
import { abilityModifier, formatModifier } from "../../../shared/dnd/math";
import { createSpinButtons } from "../../../shared/edit/spin-buttons";
import { type DomRefs, getAbilityScore } from "./types";

/**
 * Renders the ability score grid (STR/DEX/CON/INT/WIS/CHA) with each
 * column showing a number input (with spinners) and the derived
 * modifier. Populates `refs.abilityScoreCells` and
 * `refs.abilityModCells` so the orchestrator can live-update the
 * modifier cells when a score changes.
 */
export function renderAbilities(
  block: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): void {
  const m = state.current;
  const abilitiesBlock = block.createDiv({ cls: "abilities-block" });
  const abTable = abilitiesBlock.createEl("table", { cls: "abilities-table" });
  const abThead = abTable.createEl("thead");
  const abHeadRow = abThead.createEl("tr");
  const abTbody = abTable.createEl("tbody");
  const abValRow = abTbody.createEl("tr");

  refs.abilityModCells = {};
  refs.abilityScoreCells = {};

  for (const key of ABILITY_KEYS) {
    abHeadRow.createEl("th", { text: ABILITY_NAMES[key] });

    const valTd = abValRow.createEl("td");
    const scoreWrap = valTd.createDiv({ cls: "archivist-num-wrap" });
    const scoreInput = scoreWrap.createEl("input", { cls: "archivist-num-in" });
    scoreInput.type = "number";
    scoreInput.value = String(getAbilityScore(m, key));
    scoreInput.addEventListener("input", () => {
      const abilities = { ...(state.current.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) };
      abilities[key] = parseInt(scoreInput.value) || 10;
      state.updateField("abilities", abilities);
    });
    createSpinButtons(scoreWrap, scoreInput);
    refs.abilityScoreCells[key] = scoreInput;

    // Modifier in SAME td, below the input
    const modDiv = valTd.createDiv({ cls: "archivist-ability-mod" });
    const mod = abilityModifier(getAbilityScore(m, key));
    modDiv.textContent = `(${formatModifier(mod)})`;
    refs.abilityModCells[key] = modDiv;
  }
}
