import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { ALL_SKILLS } from "@archivist-gg/dnd5e/dnd/constants";
import { formatModifier } from "@archivist-gg/dnd5e/dnd/math";
import type { SkillSlug } from "@archivist-gg/dnd5e";
import { renderConditionTags, rollModifierTagSpec, type ConditionTagSpec } from "./condition-tag";
import { ROLL_MODE_TAG } from "@archivist-gg/dnd5e/pc/roll-tag-labels";
import { numberOverride } from "./edit-primitives";
import { attachStatBreakdown } from "./stat-breakdown";

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
      attachStatBreakdown(bonusEl, {
        title: SKILL_DISPLAY_NAMES[skillSlug] ?? display,
        total: entry.bonus,
        terms: ctx.derived.statBreakdowns?.skills[skillSlug],
        overridden: ctx.resolved.definition?.overrides?.skills?.[skillSlug]?.bonus !== undefined,
      });
      row.createSpan({ cls: "pc-skill-name", text: SKILL_DISPLAY_NAMES[skillSlug] ?? display });
      // R4-G7 T8 RIDER-20: the row's tags are collected, then rendered once so same-text tags merge.
      const specs: ConditionTagSpec[] = [];
      const ce = ctx.derived.conditionEffects;
      if (ce) {
        if (ce.ability_check_disadvantage) {
          const sources = ce.sources
            .filter((s) => skillDisSources.has(s.condition))
            .map((s) => s.condition === "exhaustion" ? `exhaustion ${s.level}` : s.condition);
          specs.push({ kindClass: "dis", text: ROLL_MODE_TAG.disadvantage, tooltip: `Disadvantage on ability checks from ${sources.join(", ")}` });
        }
      }

      // Structured roll-modifier effects scoped to ability checks. An entry
      // applies to this row when it is unscoped (all checks), when its scope
      // matches the skill slug, or (R4-G3a §6.2.3) when its scope is the
      // ABILITY KEY this row rolls with ("Strength checks" normalises to "str",
      // not to a skill). `entry.ability` is the row's own already-resolved key:
      // SKILL_ABILITY is keyed by space-separated display names and returns
      // undefined for `animal-handling` / `sleight-of-hand`, so it is the wrong
      // map here. Order-preserving; one spec per matching entry (a conditional one is marked, RIDER-20).
      for (const rm of ctx.derived.rollModifiers ?? []) {
        if (rm.roll !== "ability-check") continue;
        if (rm.scope && rm.scope !== skillSlug && rm.scope !== entry.ability) continue;
        specs.push(rollModifierTagSpec(rm));
      }
      renderConditionTags(() => row, specs);
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
