import type { MonsterEditState } from "../monster.edit-state";
import { ALL_SKILLS, SKILL_ABILITY } from "../../../shared/dnd/constants";
import { formatModifier, skillBonus } from "../../../shared/dnd/math";
import { wireOverride } from "../../../shared/edit/override-system";
import { createCollapsible } from "../../../shared/edit/collapsible";
import { type DomRefs, getAbilityScore, updateSkillToggle } from "./types";

/**
 * Renders the collapsible Skills section: one row per skill with a
 * three-state proficiency toggle (none / proficient / expertise),
 * the auto-calculated bonus (click to override), and the override
 * asterisk if already overridden. The skill's associated ability is
 * resolved via `SKILL_ABILITY`.
 */
export function renderSkills(
  block: HTMLElement,
  state: MonsterEditState,
  refs: DomRefs,
): void {
  const skillsSection = block.createDiv({ cls: "property-block" });
  const { grid: skillsGrid } = createCollapsible(skillsSection, "Skills", false);
  skillsGrid.addClass("archivist-skills-grid");
  refs.skillsGrid = skillsGrid;

  for (const skill of ALL_SKILLS) {
    const skillLower = skill.toLowerCase();
    const abilityKey = SKILL_ABILITY[skillLower];
    const item = skillsGrid.createDiv({ cls: "archivist-skill-item" });

    const profLevel = state.current.skillProficiencies[skillLower] ?? "none";
    const toggle = item.createDiv({ cls: `archivist-prof-toggle${profLevel !== "none" ? ` ${profLevel}` : ""}` });
    toggle.addEventListener("click", () => {
      state.cycleSkillProficiency(skillLower);
      updateSkillToggle(toggle, state.current.skillProficiencies[skillLower] ?? "none");
    });
    refs.skillToggles[skillLower] = toggle;

    item.createEl("span", { cls: "archivist-skill-name", text: skill });

    const valEl = item.createEl("span", { cls: "archivist-skill-value archivist-auto-value" });
    const score = getAbilityScore(state.current, abilityKey);
    const skillIsOverridden = state.current.overrides.has(`skills.${skillLower}`);
    // Capitalize skill name for Monster.skills format (e.g., "animal handling" -> "Animal Handling")
    const skillDisplayName = skillLower.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const bonus = skillIsOverridden && state.current.skills?.[skillDisplayName] !== undefined
      ? state.current.skills[skillDisplayName]
      : skillBonus(score, profLevel, state.current.proficiencyBonus);
    valEl.textContent = formatModifier(bonus);
    if (profLevel !== "none") valEl.addClass("proficient-value");
    refs.skillValues[skillLower] = valEl;

    const skillAutoLabel = item.createEl("span", { cls: "archivist-auto-label" });
    wireOverride(valEl, skillAutoLabel, `skills.${skillLower}`,
      () => {
        const sc = getAbilityScore(state.current, abilityKey);
        const prof = state.current.skillProficiencies[skillLower] ?? "none";
        return skillBonus(sc, prof, state.current.proficiencyBonus);
      },
      (val) => {
        if (!state.current.skills) state.current.skills = {};
        state.current.skills[skillDisplayName] = val;
        state.setOverride(`skills.${skillLower}`, val);
      },
      () => {
        state.clearOverride(`skills.${skillLower}`);
      },
      formatModifier,
      skillIsOverridden,
    );
  }
}
