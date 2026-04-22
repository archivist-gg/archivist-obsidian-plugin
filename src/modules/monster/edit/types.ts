import type { Monster, MonsterAbilities } from "../monster.types";
import type { EditableMonster } from "../monster.edit-state";

/**
 * DOM references collected by the sub-editors. Populated progressively
 * as each section renders; consumed by `updateDom()` in the orchestrator
 * to react to state changes without a full re-render.
 */
export interface DomRefs {
  hpValue: HTMLElement;
  hpFormula: HTMLInputElement;
  xpValue: HTMLElement;
  abilityModCells: Record<string, HTMLElement>;
  abilityScoreCells: Record<string, HTMLInputElement>;
  savesGrid: HTMLElement;
  saveValues: Record<string, HTMLElement>;
  saveToggles: Record<string, HTMLElement>;
  skillsGrid: HTMLElement;
  skillValues: Record<string, HTMLElement>;
  skillToggles: Record<string, HTMLElement>;
  sensePPValue: HTMLElement;
  tabContent: HTMLElement;
  tabBar: HTMLElement;
}

// Section key used in activeSections / EditableMonster
export type SectionKey =
  | "traits"
  | "actions"
  | "reactions"
  | "legendary"
  | "bonus_actions"
  | "lair_actions"
  | "mythic_actions";

export const SECTION_LABELS: Record<string, string> = {
  traits: "Traits", actions: "Actions", reactions: "Reactions",
  legendary: "Legendary Actions", bonus_actions: "Bonus Actions",
  lair_actions: "Lair Actions", mythic_actions: "Mythic Actions",
};

export const SECTION_SINGULAR: Record<string, string> = {
  traits: "Trait", actions: "Action", reactions: "Reaction",
  legendary: "Legendary Action", bonus_actions: "Bonus Action",
  lair_actions: "Lair Action", mythic_actions: "Mythic Action",
};

export const SECTION_KEY_MAP: Record<string, SectionKey> = {
  "Traits": "traits", "Actions": "actions", "Reactions": "reactions",
  "Legendary Actions": "legendary", "Bonus Actions": "bonus_actions",
  "Lair Actions": "lair_actions", "Mythic Actions": "mythic_actions",
};

// Small toggle / animation / accessor helpers used by multiple sub-editors.

export function updateSaveToggle(toggle: HTMLElement, isProficient: boolean): void {
  toggle.removeClass("proficient");
  if (isProficient) toggle.addClass("proficient");
}

export function updateSkillToggle(toggle: HTMLElement, level: "none" | "proficient" | "expertise"): void {
  toggle.removeClass("proficient");
  toggle.removeClass("expertise");
  if (level !== "none") toggle.addClass(level);
}

export function flashUpdate(el: HTMLElement, newValue: string): void {
  if (el.textContent === newValue) return;
  el.textContent = newValue;
  el.removeClass("flash");
  // Force reflow
  void el.offsetWidth;
  el.addClass("flash");
}

export function getAbilityScore(m: EditableMonster | Monster, key: string): number {
  if (!m.abilities) return 10;
  return m.abilities[key as keyof MonsterAbilities] ?? 10;
}

export function formatXP(xp: number): string {
  return xp.toLocaleString();
}
