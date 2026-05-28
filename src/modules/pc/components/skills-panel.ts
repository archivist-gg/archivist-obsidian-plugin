import { setTooltip } from "obsidian";
import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { ALL_SKILLS } from "../../../shared/dnd/constants";
import { formatModifier } from "../../../shared/dnd/math";
import type { SkillSlug } from "../../../shared/types";
import { renderConditionTag } from "./condition-tag";
import { numberOverride } from "./edit-primitives";

const SKILL_DISPLAY_NAMES: Record<SkillSlug, string> = {
  "acrobatics": "Acrobatics",
  "animal-handling": "Animal Handling",
  "arcana": "Arcana",
  "athletics": "Athletics",
  "deception": "Deception",
  "history": "History",
  "insight": "Insight",
  "intimidation": "Intimidation",
  "investigation": "Investigation",
  "medicine": "Medicine",
  "nature": "Nature",
  "perception": "Perception",
  "performance": "Performance",
  "persuasion": "Persuasion",
  "religion": "Religion",
  "sleight-of-hand": "Sleight of Hand",
  "stealth": "Stealth",
  "survival": "Survival",
};

function skillSlugFromDisplay(display: string): SkillSlug {
  return display.toLowerCase().replace(/\s+/g, "-") as SkillSlug;
}

const skillDisSources = new Set(["frightened", "poisoned", "exhaustion"]);

export class SkillsPanel implements SheetComponent {
  readonly type = "skills-panel";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const section = el.createDiv({ cls: "pc-sidebar-section" });
    section.createDiv({ cls: "pc-sidebar-title", text: "Skills" });
    const list = section.createDiv({ cls: "pc-skills-list" });
    const sortedDisplays = [...ALL_SKILLS].sort((a, b) => a.localeCompare(b));
    for (const display of sortedDisplays) {
      const skillSlug = skillSlugFromDisplay(display);
      const entry = ctx.derived.skills[skillSlug];
      if (!entry) continue;
      const row = list.createDiv({ cls: "pc-skill-row", attr: { "data-skill": skillSlug } });
      const toggleClasses = ["archivist-prof-toggle"];
      if (entry.proficiency === "expertise") toggleClasses.push("expertise");
      else if (entry.proficiency === "proficient") toggleClasses.push("proficient");
      row.createSpan({ cls: toggleClasses.join(" ") });
      const bonusEl = row.createSpan({ cls: "pc-skill-bonus", text: formatModifier(entry.bonus) });
      row.createSpan({ cls: "pc-skill-name", text: SKILL_DISPLAY_NAMES[skillSlug] ?? display });
      const ce = ctx.derived.conditionEffects;
      if (ce) {
        if (ce.ability_check_disadvantage) {
          const sources = ce.sources
            .filter((s) => skillDisSources.has(s.condition))
            .map((s) => s.condition === "exhaustion" ? `exhaustion ${s.level}` : s.condition);
          renderConditionTag(row, "DIS", `Disadvantage on ability checks from ${sources.join(", ")}`);
        }
        if (ce.d20_test_penalty !== 0) {
          const baseBonus = entry.bonus - ce.d20_test_penalty;
          setTooltip(
            bonusEl,
            `${baseBonus >= 0 ? "+" : ""}${baseBonus} base ${ce.d20_test_penalty < 0 ? "−" : "+"} ${Math.abs(ce.d20_test_penalty)} from exhaustion`,
          );
        }
      }
      if (ctx.editState) {
        row.addEventListener("click", () => ctx.editState!.cycleSkill(skillSlug));
        bonusEl.addEventListener("click", (e) => e.stopPropagation());
        numberOverride(bonusEl, {
          getEffective: () => entry.bonus,
          isOverridden: () => ctx.resolved.definition?.overrides?.skills?.[skillSlug]?.bonus !== undefined,
          onSet: (n) => ctx.editState!.setSkillBonusOverride(skillSlug, n),
          onClear: () => ctx.editState!.clearSkillBonusOverride(skillSlug),
          min: -20, max: 30,
        });
      }
    }
  }
}
