# Stat Block Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline edit mode to D&D stat blocks with a math engine that auto-recalculates derived values, extended formula tags that bind action text to ability scores, multi-column layout, and bidirectional YAML sync.

**Architecture:** Pure-function D&D math engine (`src/dnd/`) feeds an `EditableMonster` state type that tracks overrides and proficiencies. The monster renderer conditionally renders edit UI (inputs, toggles, grids) when edit mode is active. Formula tags extend the existing inline tag parser with ability-name detection. Backtick autocomplete triggers inside feature textareas. Side buttons swap between default/editing/save states.

**Tech Stack:** TypeScript, Obsidian API (`MarkdownPostProcessorContext`, `Editor`, `setIcon`), Vitest, CSS custom properties, vanilla DOM (no frameworks).

---

## File Structure

### New Files

```
src/dnd/
  constants.ts          -- CR/XP/Size/Skill lookup tables (exported constants)
  math.ts               -- Pure D&D 5e math functions
  recalculate.ts        -- Orchestrator: cascades stat changes through dependency graph
  editable-monster.ts   -- EditableMonster type + monsterToEditable + editableToMonster
  formula-tags.ts       -- Formula tag detection + resolution
  yaml-serializer.ts    -- EditableMonster -> YAML string

src/edit/
  edit-state.ts         -- Edit mode state manager (activate/deactivate/pending changes)
  side-buttons.ts       -- Side button rendering + state transitions
  monster-edit-render.ts -- Renders all edit mode UI for monster blocks
  tag-autocomplete.ts   -- Backtick autocomplete dropdown for formula tags
  multi-column.ts       -- Column toggle logic + CSS class management
  spell-edit-render.ts  -- Simple edit mode for spell blocks
  item-edit-render.ts   -- Simple edit mode for item blocks

src/styles/
  archivist-edit.css    -- All edit mode CSS

tests/
  dnd-math.test.ts      -- Tests for math.ts
  dnd-constants.test.ts -- Tests for constants.ts
  dnd-recalculate.test.ts -- Tests for recalculate.ts
  editable-monster.test.ts -- Tests for editable-monster.ts
  formula-tags.test.ts  -- Tests for formula-tags.ts
  yaml-serializer.test.ts -- Tests for yaml-serializer.ts
```

### Modified Files

```
src/parsers/inline-tag-parser.ts  -- Add formula field to InlineTag
src/renderers/renderer-utils.ts   -- Update renderStatBlockTag for formula tags
src/renderers/monster-renderer.ts -- Add edit mode rendering branch
src/renderers/spell-renderer.ts   -- Add edit mode rendering branch
src/renderers/item-renderer.ts    -- Add edit mode rendering branch
src/main.ts                       -- Wire edit mode into renderBlock, add settings
src/types/settings.ts             -- Add multi-column settings
src/styles/archivist-dnd.css      -- Add multi-column CSS, side button CSS
```

---

### Task 1: D&D 5e Constants

**Files:**
- Create: `src/dnd/constants.ts`
- Create: `tests/dnd-constants.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/dnd-constants.test.ts
import { describe, it, expect } from "vitest";
import {
  CR_PROFICIENCY,
  CR_XP,
  SIZE_HIT_DICE,
  SKILL_ABILITY,
  ALL_CR_VALUES,
  DAMAGE_TYPES,
  ABILITY_KEYS,
} from "../src/dnd/constants";

describe("CR_PROFICIENCY", () => {
  it("CR 0 through 4 have proficiency +2", () => {
    for (const cr of ["0", "1/8", "1/4", "1/2", "1", "2", "3", "4"]) {
      expect(CR_PROFICIENCY[cr]).toBe(2);
    }
  });

  it("CR 5 through 8 have proficiency +3", () => {
    for (const cr of ["5", "6", "7", "8"]) {
      expect(CR_PROFICIENCY[cr]).toBe(3);
    }
  });

  it("CR 9 through 12 have proficiency +4", () => {
    for (const cr of ["9", "10", "11", "12"]) {
      expect(CR_PROFICIENCY[cr]).toBe(4);
    }
  });

  it("CR 29-30 have proficiency +9", () => {
    expect(CR_PROFICIENCY["29"]).toBe(9);
    expect(CR_PROFICIENCY["30"]).toBe(9);
  });

  it("covers all 33 CR values", () => {
    expect(Object.keys(CR_PROFICIENCY)).toHaveLength(33);
  });
});

describe("CR_XP", () => {
  it("CR 0 = 10 XP", () => expect(CR_XP["0"]).toBe(10));
  it("CR 1/4 = 50 XP", () => expect(CR_XP["1/4"]).toBe(50));
  it("CR 1 = 200 XP", () => expect(CR_XP["1"]).toBe(200));
  it("CR 20 = 25000 XP", () => expect(CR_XP["20"]).toBe(25000));
  it("CR 30 = 155000 XP", () => expect(CR_XP["30"]).toBe(155000));
  it("covers all 33 CR values", () => {
    expect(Object.keys(CR_XP)).toHaveLength(33);
  });
});

describe("SIZE_HIT_DICE", () => {
  it("tiny = d4", () => expect(SIZE_HIT_DICE["tiny"]).toBe(4));
  it("small = d6", () => expect(SIZE_HIT_DICE["small"]).toBe(6));
  it("medium = d8", () => expect(SIZE_HIT_DICE["medium"]).toBe(8));
  it("large = d10", () => expect(SIZE_HIT_DICE["large"]).toBe(10));
  it("huge = d12", () => expect(SIZE_HIT_DICE["huge"]).toBe(12));
  it("gargantuan = d20", () => expect(SIZE_HIT_DICE["gargantuan"]).toBe(20));
});

describe("SKILL_ABILITY", () => {
  it("maps all 18 skills", () => {
    expect(Object.keys(SKILL_ABILITY)).toHaveLength(18);
  });
  it("acrobatics uses dex", () => expect(SKILL_ABILITY["acrobatics"]).toBe("dex"));
  it("athletics uses str", () => expect(SKILL_ABILITY["athletics"]).toBe("str"));
  it("perception uses wis", () => expect(SKILL_ABILITY["perception"]).toBe("wis"));
  it("stealth uses dex", () => expect(SKILL_ABILITY["stealth"]).toBe("dex"));
  it("animal handling uses wis", () => expect(SKILL_ABILITY["animal handling"]).toBe("wis"));
  it("sleight of hand uses dex", () => expect(SKILL_ABILITY["sleight of hand"]).toBe("dex"));
  it("arcana uses int", () => expect(SKILL_ABILITY["arcana"]).toBe("int"));
  it("deception uses cha", () => expect(SKILL_ABILITY["deception"]).toBe("cha"));
});

describe("ALL_CR_VALUES", () => {
  it("has 33 entries in display order", () => {
    expect(ALL_CR_VALUES).toHaveLength(33);
    expect(ALL_CR_VALUES[0]).toBe("0");
    expect(ALL_CR_VALUES[1]).toBe("1/8");
    expect(ALL_CR_VALUES[2]).toBe("1/4");
    expect(ALL_CR_VALUES[3]).toBe("1/2");
    expect(ALL_CR_VALUES[4]).toBe("1");
    expect(ALL_CR_VALUES[32]).toBe("30");
  });
});

describe("ABILITY_KEYS", () => {
  it("has 6 entries in standard order", () => {
    expect(ABILITY_KEYS).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dnd-constants.test.ts`
Expected: FAIL -- module `../src/dnd/constants` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/dnd/constants.ts

/** CR -> Proficiency Bonus (D&D 5e SRD) */
export const CR_PROFICIENCY: Record<string, number> = {
  "0": 2, "1/8": 2, "1/4": 2, "1/2": 2,
  "1": 2, "2": 2, "3": 2, "4": 2,
  "5": 3, "6": 3, "7": 3, "8": 3,
  "9": 4, "10": 4, "11": 4, "12": 4,
  "13": 5, "14": 5, "15": 5, "16": 5,
  "17": 6, "18": 6, "19": 6, "20": 6,
  "21": 7, "22": 7, "23": 7, "24": 7,
  "25": 8, "26": 8, "27": 8, "28": 8,
  "29": 9, "30": 9,
};

/** CR -> XP (D&D 5e SRD) */
export const CR_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

/** All CR values in display order for dropdowns */
export const ALL_CR_VALUES: string[] = [
  "0", "1/8", "1/4", "1/2",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];

/** Creature Size -> Hit Dice Size */
export const SIZE_HIT_DICE: Record<string, number> = {
  tiny: 4, small: 6, medium: 8, large: 10, huge: 12, gargantuan: 20,
};

/** All creature sizes in order */
export const ALL_SIZES: string[] = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

/** Skill -> Governing Ability (lowercase keys) */
export const SKILL_ABILITY: Record<string, string> = {
  "acrobatics": "dex",
  "animal handling": "wis",
  "arcana": "int",
  "athletics": "str",
  "deception": "cha",
  "history": "int",
  "insight": "wis",
  "intimidation": "cha",
  "investigation": "int",
  "medicine": "wis",
  "nature": "int",
  "perception": "wis",
  "performance": "cha",
  "persuasion": "cha",
  "religion": "int",
  "sleight of hand": "dex",
  "stealth": "dex",
  "survival": "wis",
};

/** All 18 skills in alphabetical display order */
export const ALL_SKILLS: string[] = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics",
  "Deception", "History", "Insight", "Intimidation", "Investigation",
  "Medicine", "Nature", "Perception", "Performance", "Persuasion",
  "Religion", "Sleight of Hand", "Stealth", "Survival",
];

/** The six ability score keys in standard order */
export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** Ability key -> display name */
export const ABILITY_NAMES: Record<string, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

/** Standard D&D 5e damage types */
export const DAMAGE_TYPES: string[] = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force",
  "Lightning", "Necrotic", "Piercing", "Poison",
  "Psychic", "Radiant", "Slashing", "Thunder",
];

/** Standard D&D 5e conditions */
export const CONDITIONS: string[] = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

/** Standard D&D 5e senses */
export const STANDARD_SENSES: string[] = ["Blindsight", "Darkvision", "Tremorsense", "Truesight"];

/** Alignment axis options */
export const ALIGNMENT_ETHICAL: string[] = ["Lawful", "Neutral", "Chaotic", "Unaligned", "Any"];
export const ALIGNMENT_MORAL: string[] = ["Good", "Neutral", "Evil"];

/** All section types for tab management */
export const ALL_SECTIONS: string[] = [
  "Traits", "Actions", "Reactions", "Bonus Actions",
  "Legendary Actions", "Lair Actions", "Mythic Actions",
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dnd-constants.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dnd/constants.ts tests/dnd-constants.test.ts
git commit -m "feat: add D&D 5e constants (CR tables, skills, sizes, damage types)"
```

---

### Task 2: D&D 5e Math Functions

**Files:**
- Create: `src/dnd/math.ts`
- Create: `tests/dnd-math.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/dnd-math.test.ts
import { describe, it, expect } from "vitest";
import {
  abilityModifier,
  formatModifier,
  proficiencyBonusFromCR,
  crToXP,
  hitDiceSizeFromCreatureSize,
  hpFromHitDice,
  savingThrow,
  skillBonus,
  passivePerception,
  attackBonus,
  saveDC,
  abilityNameToKey,
  parseHitDiceFormula,
} from "../src/dnd/math";

describe("abilityModifier", () => {
  it("score 10 -> +0", () => expect(abilityModifier(10)).toBe(0));
  it("score 11 -> +0", () => expect(abilityModifier(11)).toBe(0));
  it("score 1 -> -5", () => expect(abilityModifier(1)).toBe(-5));
  it("score 8 -> -1", () => expect(abilityModifier(8)).toBe(-1));
  it("score 14 -> +2", () => expect(abilityModifier(14)).toBe(2));
  it("score 20 -> +5", () => expect(abilityModifier(20)).toBe(5));
  it("score 30 -> +10", () => expect(abilityModifier(30)).toBe(10));
});

describe("formatModifier", () => {
  it("positive adds +", () => expect(formatModifier(3)).toBe("+3"));
  it("zero adds +", () => expect(formatModifier(0)).toBe("+0"));
  it("negative keeps -", () => expect(formatModifier(-2)).toBe("-2"));
});

describe("proficiencyBonusFromCR", () => {
  it("CR 0 -> +2", () => expect(proficiencyBonusFromCR("0")).toBe(2));
  it("CR 1/4 -> +2", () => expect(proficiencyBonusFromCR("1/4")).toBe(2));
  it("CR 5 -> +3", () => expect(proficiencyBonusFromCR("5")).toBe(3));
  it("CR 10 -> +4", () => expect(proficiencyBonusFromCR("10")).toBe(4));
  it("CR 17 -> +6", () => expect(proficiencyBonusFromCR("17")).toBe(6));
  it("CR 30 -> +9", () => expect(proficiencyBonusFromCR("30")).toBe(9));
  it("unknown CR defaults to +2", () => expect(proficiencyBonusFromCR("unknown")).toBe(2));
});

describe("crToXP", () => {
  it("CR 0 -> 10", () => expect(crToXP("0")).toBe(10));
  it("CR 1/4 -> 50", () => expect(crToXP("1/4")).toBe(50));
  it("CR 1 -> 200", () => expect(crToXP("1")).toBe(200));
  it("CR 30 -> 155000", () => expect(crToXP("30")).toBe(155000));
  it("unknown CR returns 0", () => expect(crToXP("unknown")).toBe(0));
});

describe("hitDiceSizeFromCreatureSize", () => {
  it("tiny -> d4", () => expect(hitDiceSizeFromCreatureSize("tiny")).toBe(4));
  it("small -> d6", () => expect(hitDiceSizeFromCreatureSize("small")).toBe(6));
  it("medium -> d8", () => expect(hitDiceSizeFromCreatureSize("medium")).toBe(8));
  it("large -> d10", () => expect(hitDiceSizeFromCreatureSize("large")).toBe(10));
  it("huge -> d12", () => expect(hitDiceSizeFromCreatureSize("huge")).toBe(12));
  it("gargantuan -> d20", () => expect(hitDiceSizeFromCreatureSize("gargantuan")).toBe(20));
  it("is case-insensitive", () => expect(hitDiceSizeFromCreatureSize("Large")).toBe(10));
  it("unknown defaults to d8", () => expect(hitDiceSizeFromCreatureSize("unknown")).toBe(8));
});

describe("hpFromHitDice", () => {
  it("Goblin: 2d6, CON +0 -> 7", () => {
    expect(hpFromHitDice(2, 6, 0)).toBe(7);
  });
  it("Goblin: 2d6, CON +2 -> 11", () => {
    expect(hpFromHitDice(2, 6, 2)).toBe(11);
  });
  it("Ancient Dragon: 21d20, CON +7 -> 367", () => {
    expect(hpFromHitDice(21, 20, 7)).toBe(367);
  });
  it("1d8, CON +1 -> 5", () => {
    expect(hpFromHitDice(1, 8, 1)).toBe(5);
  });
  it("negative CON mod reduces HP", () => {
    expect(hpFromHitDice(1, 8, -1)).toBe(3);
  });
  it("HP minimum is 1 even with terrible CON", () => {
    expect(hpFromHitDice(1, 4, -5)).toBe(1);
  });
});

describe("parseHitDiceFormula", () => {
  it("parses 2d6", () => {
    expect(parseHitDiceFormula("2d6")).toEqual({ count: 2, size: 6 });
  });
  it("parses 21d20", () => {
    expect(parseHitDiceFormula("21d20")).toEqual({ count: 21, size: 20 });
  });
  it("parses 1d8", () => {
    expect(parseHitDiceFormula("1d8")).toEqual({ count: 1, size: 8 });
  });
  it("returns null for invalid input", () => {
    expect(parseHitDiceFormula("not dice")).toBeNull();
  });
  it("ignores trailing modifiers in formula (e.g., 2d6+3)", () => {
    expect(parseHitDiceFormula("2d6+3")).toEqual({ count: 2, size: 6 });
  });
});

describe("savingThrow", () => {
  it("non-proficient: just ability mod", () => {
    expect(savingThrow(14, false, 2)).toBe(2); // DEX 14 (+2), no prof
  });
  it("proficient: ability mod + prof bonus", () => {
    expect(savingThrow(14, true, 2)).toBe(4); // DEX 14 (+2) + prof 2
  });
  it("negative mod non-proficient", () => {
    expect(savingThrow(8, false, 2)).toBe(-1); // STR 8 (-1)
  });
  it("negative mod proficient", () => {
    expect(savingThrow(8, true, 3)).toBe(2); // STR 8 (-1) + prof 3
  });
});

describe("skillBonus", () => {
  it("none: just ability mod", () => {
    expect(skillBonus(14, "none", 2)).toBe(2);
  });
  it("proficient: mod + prof", () => {
    expect(skillBonus(14, "proficient", 2)).toBe(4);
  });
  it("expertise: mod + 2*prof", () => {
    expect(skillBonus(14, "expertise", 2)).toBe(6);
  });
  it("negative mod with expertise", () => {
    expect(skillBonus(8, "expertise", 3)).toBe(5); // -1 + 6
  });
});

describe("passivePerception", () => {
  it("WIS 8, none, prof 2 -> 9", () => {
    expect(passivePerception(8, "none", 2)).toBe(9); // 10 + (-1)
  });
  it("WIS 14, proficient, prof 2 -> 14", () => {
    expect(passivePerception(14, "proficient", 2)).toBe(14); // 10 + 2 + 2
  });
  it("WIS 10, expertise, prof 3 -> 16", () => {
    expect(passivePerception(10, "expertise", 3)).toBe(16); // 10 + 0 + 6
  });
});

describe("attackBonus", () => {
  it("DEX 14, prof 2 -> +4", () => expect(attackBonus(14, 2)).toBe(4));
  it("STR 8, prof 2 -> +1", () => expect(attackBonus(8, 2)).toBe(1));
  it("STR 27, prof 7 -> +15", () => expect(attackBonus(27, 7)).toBe(15));
});

describe("saveDC", () => {
  it("WIS 8, prof 2 -> 9", () => expect(saveDC(8, 2)).toBe(9)); // 8 + 2 + (-1)
  it("CON 25, prof 7 -> 22", () => expect(saveDC(25, 7)).toBe(22)); // 8 + 7 + 7
  it("CHA 19, prof 7 -> 19", () => expect(saveDC(19, 7)).toBe(19)); // 8 + 7 + 4
});

describe("abilityNameToKey", () => {
  it("STR -> str", () => expect(abilityNameToKey("STR")).toBe("str"));
  it("dex -> dex", () => expect(abilityNameToKey("dex")).toBe("dex"));
  it("Wisdom -> null (only abbreviations)", () => expect(abilityNameToKey("Wisdom")).toBeNull());
  it("FOO -> null", () => expect(abilityNameToKey("FOO")).toBeNull());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dnd-math.test.ts`
Expected: FAIL -- module `../src/dnd/math` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/dnd/math.ts
import { CR_PROFICIENCY, CR_XP, SIZE_HIT_DICE, ABILITY_KEYS } from "./constants";
import type { MonsterAbilities } from "../types/monster";

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonusFromCR(cr: string): number {
  return CR_PROFICIENCY[cr] ?? 2;
}

export function crToXP(cr: string): number {
  return CR_XP[cr] ?? 0;
}

export function hitDiceSizeFromCreatureSize(size: string): number {
  return SIZE_HIT_DICE[size.toLowerCase()] ?? 8;
}

export function hpFromHitDice(hitDiceCount: number, hitDiceSize: number, conMod: number): number {
  const avg = Math.floor(hitDiceCount * (hitDiceSize + 1) / 2 + hitDiceCount * conMod);
  return Math.max(1, avg);
}

export function parseHitDiceFormula(formula: string): { count: number; size: number } | null {
  const match = formula.match(/^(\d+)d(\d+)/i);
  if (!match) return null;
  return { count: parseInt(match[1], 10), size: parseInt(match[2], 10) };
}

export function savingThrow(abilityScore: number, isProficient: boolean, profBonus: number): number {
  return abilityModifier(abilityScore) + (isProficient ? profBonus : 0);
}

export function skillBonus(
  abilityScore: number,
  proficiency: "none" | "proficient" | "expertise",
  profBonus: number,
): number {
  const mod = abilityModifier(abilityScore);
  if (proficiency === "expertise") return mod + profBonus * 2;
  if (proficiency === "proficient") return mod + profBonus;
  return mod;
}

export function passivePerception(
  wisScore: number,
  perceptionProf: "none" | "proficient" | "expertise",
  profBonus: number,
): number {
  return 10 + skillBonus(wisScore, perceptionProf, profBonus);
}

export function attackBonus(abilityScore: number, profBonus: number): number {
  return abilityModifier(abilityScore) + profBonus;
}

export function saveDC(abilityScore: number, profBonus: number): number {
  return 8 + profBonus + abilityModifier(abilityScore);
}

export function abilityNameToKey(name: string): (typeof ABILITY_KEYS)[number] | null {
  const lower = name.toLowerCase();
  if ((ABILITY_KEYS as readonly string[]).includes(lower)) {
    return lower as (typeof ABILITY_KEYS)[number];
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dnd-math.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dnd/math.ts tests/dnd-math.test.ts
git commit -m "feat: add D&D 5e math functions (modifiers, saves, skills, HP, DC, attack)"
```

---

### Task 3: EditableMonster Type & Conversions

**Files:**
- Create: `src/dnd/editable-monster.ts`
- Create: `tests/editable-monster.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/editable-monster.test.ts
import { describe, it, expect } from "vitest";
import { monsterToEditable, editableToMonster } from "../src/dnd/editable-monster";
import type { Monster } from "../src/types/monster";

const GOBLIN: Monster = {
  name: "Goblin",
  size: "Small",
  type: "Humanoid",
  alignment: "Neutral Evil",
  cr: "1/4",
  ac: [{ ac: 15, from: ["leather armor", "shield"] }],
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  saves: { dex: 4 },
  skills: { Stealth: 6 },
  senses: ["darkvision 60 ft."],
  passive_perception: 9,
  languages: ["Common", "Goblin"],
  traits: [{ name: "Nimble Escape", entries: ["The goblin can take the Disengage or Hide action as a bonus action."] }],
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit, reach 5 ft. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("monsterToEditable", () => {
  it("preserves all base monster fields", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.name).toBe("Goblin");
    expect(editable.size).toBe("Small");
    expect(editable.cr).toBe("1/4");
    expect(editable.abilities?.dex).toBe(14);
  });

  it("initializes empty overrides set", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.overrides.size).toBe(0);
  });

  it("infers DEX save proficiency from existing saves", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.saveProficiencies["dex"]).toBe(true);
    expect(editable.saveProficiencies["str"]).toBe(false);
  });

  it("infers Stealth expertise from skill value exceeding prof+mod", () => {
    const editable = monsterToEditable(GOBLIN);
    // Stealth +6 = DEX(+2) + prof(2)*2 -> expertise
    expect(editable.skillProficiencies["stealth"]).toBe("expertise");
  });

  it("detects active senses", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.activeSenses["darkvision"]).toBe("60 ft.");
    expect(editable.activeSenses["blindsight"]).toBeNull();
  });

  it("detects active sections from traits/actions", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.activeSections).toContain("traits");
    expect(editable.activeSections).toContain("actions");
    expect(editable.activeSections).not.toContain("legendary");
  });

  it("calculates proficiency bonus from CR", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.proficiencyBonus).toBe(2);
  });

  it("calculates XP from CR", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.xp).toBe(50);
  });
});

describe("editableToMonster", () => {
  it("round-trips: monsterToEditable -> editableToMonster preserves data", () => {
    const editable = monsterToEditable(GOBLIN);
    const monster = editableToMonster(editable);
    expect(monster.name).toBe("Goblin");
    expect(monster.ac).toEqual([{ ac: 15, from: ["leather armor", "shield"] }]);
    expect(monster.hp?.average).toBe(7);
    expect(monster.hp?.formula).toBe("2d6");
    expect(monster.abilities?.dex).toBe(14);
    expect(monster.actions).toHaveLength(1);
    expect(monster.traits).toHaveLength(1);
  });

  it("recalculates saves from proficiency toggles", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.saveProficiencies["str"] = true; // add STR save proficiency
    const monster = editableToMonster(editable);
    expect(monster.saves?.["str"]).toBe(1); // -1 + 2
    expect(monster.saves?.["dex"]).toBe(4); // +2 + 2
  });

  it("recalculates skills from proficiency toggles", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.skillProficiencies["perception"] = "proficient";
    const monster = editableToMonster(editable);
    expect(monster.skills?.["Perception"]).toBe(1); // WIS(-1) + prof(2)
  });

  it("omits empty sections", () => {
    const editable = monsterToEditable(GOBLIN);
    const monster = editableToMonster(editable);
    expect(monster.legendary).toBeUndefined();
    expect(monster.reactions).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/editable-monster.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```typescript
// src/dnd/editable-monster.ts
import type { Monster, MonsterAbilities } from "../types/monster";
import { SKILL_ABILITY, STANDARD_SENSES, ABILITY_KEYS } from "./constants";
import {
  abilityModifier,
  proficiencyBonusFromCR,
  crToXP,
  savingThrow,
  skillBonus,
  passivePerception,
} from "./math";

export interface EditableMonster extends Monster {
  overrides: Set<string>;
  saveProficiencies: Record<string, boolean>;
  skillProficiencies: Record<string, "none" | "proficient" | "expertise">;
  activeSenses: Record<string, string | null>;
  customSenses: Array<{ name: string; range: string }>;
  activeSections: string[];
  xp: number;
  proficiencyBonus: number;
}

export function monsterToEditable(monster: Monster): EditableMonster {
  const cr = monster.cr ?? "0";
  const profBonus = proficiencyBonusFromCR(cr);
  const abilities = monster.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // Infer save proficiencies: if the save value > ability mod, they're proficient
  const saveProficiencies: Record<string, boolean> = {};
  for (const key of ABILITY_KEYS) {
    const mod = abilityModifier(abilities[key]);
    const savedValue = monster.saves?.[key];
    saveProficiencies[key] = savedValue !== undefined && savedValue > mod;
  }

  // Infer skill proficiencies: compare value to expected
  const skillProficiencies: Record<string, "none" | "proficient" | "expertise"> = {};
  for (const [skillName, abilityKey] of Object.entries(SKILL_ABILITY)) {
    const mod = abilityModifier(abilities[abilityKey as keyof MonsterAbilities]);
    const displayName = skillName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const skillValue = monster.skills?.[displayName] ?? monster.skills?.[skillName];
    if (skillValue === undefined) {
      skillProficiencies[skillName] = "none";
    } else if (skillValue >= mod + profBonus * 2) {
      skillProficiencies[skillName] = "expertise";
    } else if (skillValue >= mod + profBonus) {
      skillProficiencies[skillName] = "proficient";
    } else {
      skillProficiencies[skillName] = "none";
    }
  }

  // Parse senses
  const activeSenses: Record<string, string | null> = {};
  for (const sense of STANDARD_SENSES) {
    activeSenses[sense.toLowerCase()] = null;
  }
  if (monster.senses) {
    for (const senseStr of monster.senses) {
      const lower = senseStr.toLowerCase();
      for (const std of STANDARD_SENSES) {
        if (lower.startsWith(std.toLowerCase())) {
          const range = senseStr.slice(std.length).trim().replace(/^,\s*/, "");
          activeSenses[std.toLowerCase()] = range || null;
          break;
        }
      }
    }
  }

  // Custom senses: anything not matching standard senses
  const customSenses: Array<{ name: string; range: string }> = [];
  if (monster.senses) {
    for (const senseStr of monster.senses) {
      const lower = senseStr.toLowerCase();
      const isStandard = STANDARD_SENSES.some(s => lower.startsWith(s.toLowerCase()));
      if (!isStandard && !lower.startsWith("passive")) {
        const parts = senseStr.match(/^(.+?)\s+(\d+\s*ft\.?)$/i);
        if (parts) {
          customSenses.push({ name: parts[1], range: parts[2] });
        } else {
          customSenses.push({ name: senseStr, range: "" });
        }
      }
    }
  }

  // Active sections
  const activeSections: string[] = [];
  if (monster.traits && monster.traits.length > 0) activeSections.push("traits");
  if (monster.actions && monster.actions.length > 0) activeSections.push("actions");
  if (monster.reactions && monster.reactions.length > 0) activeSections.push("reactions");
  if (monster.legendary && monster.legendary.length > 0) activeSections.push("legendary");

  return {
    ...monster,
    overrides: new Set(),
    saveProficiencies,
    skillProficiencies,
    activeSenses,
    customSenses,
    activeSections,
    xp: crToXP(cr),
    proficiencyBonus: profBonus,
  };
}

export function editableToMonster(editable: EditableMonster): Monster {
  const abilities = editable.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const profBonus = editable.proficiencyBonus;

  // Rebuild saves from proficiency toggles
  const saves: Record<string, number> = {};
  let hasSaves = false;
  for (const key of ABILITY_KEYS) {
    if (editable.saveProficiencies[key]) {
      saves[key] = savingThrow(abilities[key], true, profBonus);
      hasSaves = true;
    }
  }

  // Rebuild skills from proficiency toggles
  const skills: Record<string, number> = {};
  let hasSkills = false;
  for (const [skillName, abilityKey] of Object.entries(SKILL_ABILITY)) {
    const prof = editable.skillProficiencies[skillName];
    if (prof && prof !== "none") {
      const displayName = skillName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      skills[displayName] = skillBonus(abilities[abilityKey as keyof MonsterAbilities], prof, profBonus);
      hasSkills = true;
    }
  }

  // Rebuild senses
  const senses: string[] = [];
  for (const [sense, range] of Object.entries(editable.activeSenses)) {
    if (range) {
      const displayName = sense.charAt(0).toUpperCase() + sense.slice(1);
      senses.push(`${displayName} ${range}`);
    }
  }
  for (const custom of editable.customSenses) {
    senses.push(custom.range ? `${custom.name} ${custom.range}` : custom.name);
  }

  // Calculate passive perception
  const percProf = editable.skillProficiencies["perception"] ?? "none";
  const pp = passivePerception(abilities.wis, percProf, profBonus);

  const monster: Monster = {
    name: editable.name,
    size: editable.size,
    type: editable.type,
    subtype: editable.subtype,
    alignment: editable.alignment,
    cr: editable.cr,
    ac: editable.ac,
    hp: editable.hp,
    speed: editable.speed,
    abilities: editable.abilities,
    saves: hasSaves ? saves : undefined,
    skills: hasSkills ? skills : undefined,
    senses: senses.length > 0 ? senses : undefined,
    passive_perception: pp,
    languages: editable.languages,
    damage_vulnerabilities: editable.damage_vulnerabilities,
    damage_resistances: editable.damage_resistances,
    damage_immunities: editable.damage_immunities,
    condition_immunities: editable.condition_immunities,
    traits: editable.activeSections.includes("traits") ? editable.traits : undefined,
    actions: editable.activeSections.includes("actions") ? editable.actions : undefined,
    reactions: editable.activeSections.includes("reactions") ? editable.reactions : undefined,
    legendary: editable.activeSections.includes("legendary") ? editable.legendary : undefined,
    legendary_actions: editable.legendary_actions,
    legendary_resistance: editable.legendary_resistance,
  };

  // Strip undefined fields
  for (const key of Object.keys(monster) as (keyof Monster)[]) {
    if (monster[key] === undefined) delete monster[key];
  }

  return monster;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/editable-monster.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dnd/editable-monster.ts tests/editable-monster.test.ts
git commit -m "feat: add EditableMonster type with monsterToEditable/editableToMonster conversions"
```

---

### Task 4: Recalculation Orchestrator

**Files:**
- Create: `src/dnd/recalculate.ts`
- Create: `tests/dnd-recalculate.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/dnd-recalculate.test.ts
import { describe, it, expect } from "vitest";
import { recalculate } from "../src/dnd/recalculate";
import { monsterToEditable } from "../src/dnd/editable-monster";
import type { Monster } from "../src/types/monster";

const GOBLIN: Monster = {
  name: "Goblin", size: "Small", type: "Humanoid", alignment: "Neutral Evil",
  cr: "1/4",
  ac: [{ ac: 15, from: ["leather armor", "shield"] }],
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  saves: { dex: 4 },
  skills: { Stealth: 6 },
  senses: ["darkvision 60 ft."],
  passive_perception: 9,
  languages: ["Common", "Goblin"],
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("recalculate", () => {
  it("recalculates HP when CON changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.con = 14; // CON mod +2
    const result = recalculate(editable, "abilities.con");
    expect(result.hp?.average).toBe(11); // floor(2 * 3.5 + 2 * 2) = 11
  });

  it("does NOT recalculate HP when HP is overridden", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.overrides.add("hp");
    editable.hp = { average: 15, formula: "2d6" };
    editable.abilities!.con = 14;
    const result = recalculate(editable, "abilities.con");
    expect(result.hp?.average).toBe(15); // stays locked
  });

  it("recalculates saves when ability changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.dex = 16; // DEX mod +3
    const result = recalculate(editable, "abilities.dex");
    // DEX save is proficient: +3 + 2 = +5
    expect(result.saves?.["dex"]).toBe(5);
  });

  it("does NOT recalculate overridden saves", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.overrides.add("saves.dex");
    editable.abilities!.dex = 16;
    const result = recalculate(editable, "abilities.dex");
    expect(result.saves?.["dex"]).toBe(4); // stays locked
  });

  it("recalculates proficiency bonus when CR changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.cr = "5"; // prof +3
    const result = recalculate(editable, "cr");
    expect(result.proficiencyBonus).toBe(3);
    expect(result.xp).toBe(1800);
    // DEX save should be: +2 + 3 = +5
    expect(result.saves?.["dex"]).toBe(5);
  });

  it("recalculates passive perception when WIS changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.wis = 14; // WIS mod +2
    const result = recalculate(editable, "abilities.wis");
    expect(result.passive_perception).toBe(12); // 10 + 2
  });

  it("recalculates HP when size changes (hit dice size changes)", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.size = "Medium"; // d8 instead of d6
    const result = recalculate(editable, "size");
    expect(result.hp?.average).toBe(9); // floor(2 * 4.5 + 0) = 9
    expect(result.hp?.formula).toBe("2d8"); // updated formula
  });

  it("recalculates skills when ability changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.dex = 16; // DEX mod +3
    const result = recalculate(editable, "abilities.dex");
    // Stealth (expertise): +3 + 2*2 = +7
    expect(result.skills?.["Stealth"]).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dnd-recalculate.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```typescript
// src/dnd/recalculate.ts
import type { EditableMonster } from "./editable-monster";
import type { MonsterAbilities } from "../types/monster";
import { SKILL_ABILITY, ABILITY_KEYS } from "./constants";
import {
  abilityModifier,
  proficiencyBonusFromCR,
  crToXP,
  savingThrow,
  skillBonus,
  passivePerception,
  hpFromHitDice,
  parseHitDiceFormula,
  hitDiceSizeFromCreatureSize,
} from "./math";

export function recalculate(monster: EditableMonster, changedField: string): EditableMonster {
  const result = { ...monster };
  const abilities = result.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // CR change -> update proficiency bonus and XP
  if (changedField === "cr") {
    result.proficiencyBonus = proficiencyBonusFromCR(result.cr ?? "0");
    if (!result.overrides.has("xp")) {
      result.xp = crToXP(result.cr ?? "0");
    }
  }

  const profBonus = result.proficiencyBonus;

  // Size change -> update hit dice size in formula and recalc HP
  if (changedField === "size" && result.hp?.formula) {
    const parsed = parseHitDiceFormula(result.hp.formula);
    if (parsed) {
      const newSize = hitDiceSizeFromCreatureSize(result.size ?? "medium");
      result.hp = {
        ...result.hp,
        formula: `${parsed.count}d${newSize}`,
      };
    }
  }

  // Recalculate HP from hit dice + CON mod
  if (!result.overrides.has("hp") && result.hp?.formula) {
    const parsed = parseHitDiceFormula(result.hp.formula);
    if (parsed) {
      const conMod = abilityModifier(abilities.con);
      result.hp = {
        ...result.hp,
        average: hpFromHitDice(parsed.count, parsed.size, conMod),
      };
    }
  }

  // Recalculate saves
  const saves: Record<string, number> = {};
  let hasSaves = false;
  for (const key of ABILITY_KEYS) {
    if (result.saveProficiencies[key]) {
      if (result.overrides.has(`saves.${key}`)) {
        saves[key] = result.saves?.[key] ?? savingThrow(abilities[key], true, profBonus);
      } else {
        saves[key] = savingThrow(abilities[key], true, profBonus);
      }
      hasSaves = true;
    }
  }
  result.saves = hasSaves ? saves : undefined;

  // Recalculate skills
  const skills: Record<string, number> = {};
  let hasSkills = false;
  for (const [skillName, abilityKey] of Object.entries(SKILL_ABILITY)) {
    const prof = result.skillProficiencies[skillName];
    if (prof && prof !== "none") {
      const displayName = skillName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      if (result.overrides.has(`skills.${skillName}`)) {
        skills[displayName] = result.skills?.[displayName] ?? skillBonus(abilities[abilityKey as keyof MonsterAbilities], prof, profBonus);
      } else {
        skills[displayName] = skillBonus(abilities[abilityKey as keyof MonsterAbilities], prof, profBonus);
      }
      hasSkills = true;
    }
  }
  result.skills = hasSkills ? skills : undefined;

  // Recalculate passive perception
  if (!result.overrides.has("passive_perception")) {
    const percProf = result.skillProficiencies["perception"] ?? "none";
    result.passive_perception = passivePerception(abilities.wis, percProf, profBonus);
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dnd-recalculate.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dnd/recalculate.ts tests/dnd-recalculate.test.ts
git commit -m "feat: add recalculation orchestrator with override support"
```

---

### Task 5: Formula Tags (Parser Extension + Resolution)

**Files:**
- Modify: `src/parsers/inline-tag-parser.ts`
- Create: `src/dnd/formula-tags.ts`
- Create: `tests/formula-tags.test.ts`
- Modify: `tests/inline-tag-parser.test.ts`

- [ ] **Step 1: Write the formula-tags test file**

```typescript
// tests/formula-tags.test.ts
import { describe, it, expect } from "vitest";
import { detectFormula, resolveFormulaTag } from "../src/dnd/formula-tags";
import type { MonsterAbilities } from "../src/types/monster";

describe("detectFormula", () => {
  it("detects ability name in atk tag", () => {
    const f = detectFormula("atk", "DEX");
    expect(f).toEqual({ ability: "dex", kind: "attack" });
  });

  it("detects ability name in damage tag", () => {
    const f = detectFormula("damage", "1d6+DEX");
    expect(f).toEqual({ ability: "dex", kind: "damage" });
  });

  it("detects ability name in dc tag", () => {
    const f = detectFormula("dc", "WIS");
    expect(f).toEqual({ ability: "wis", kind: "dc" });
  });

  it("returns null for static atk value", () => {
    expect(detectFormula("atk", "+5")).toBeNull();
  });

  it("returns null for static damage value", () => {
    expect(detectFormula("damage", "2d8+3")).toBeNull();
  });

  it("returns null for static dc value", () => {
    expect(detectFormula("dc", "15")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectFormula("atk", "str")).toEqual({ ability: "str", kind: "attack" });
    expect(detectFormula("dc", "Con")).toEqual({ ability: "con", kind: "dc" });
  });

  it("returns null for non-rollable types", () => {
    expect(detectFormula("check", "Perception")).toBeNull();
  });
});

describe("resolveFormulaTag", () => {
  const abilities: MonsterAbilities = { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 };
  const profBonus = 2;

  it("resolves atk:DEX -> +4", () => {
    expect(resolveFormulaTag("atk", "DEX", abilities, profBonus)).toBe("+4");
  });

  it("resolves atk:STR -> +1", () => {
    expect(resolveFormulaTag("atk", "STR", abilities, profBonus)).toBe("+1");
  });

  it("resolves damage:1d6+DEX -> 1d6+2", () => {
    expect(resolveFormulaTag("damage", "1d6+DEX", abilities, profBonus)).toBe("1d6+2");
  });

  it("resolves damage:2d10+STR -> 2d10-1", () => {
    expect(resolveFormulaTag("damage", "2d10+STR", abilities, profBonus)).toBe("2d10-1");
  });

  it("resolves dc:WIS -> DC 9", () => {
    expect(resolveFormulaTag("dc", "WIS", abilities, profBonus)).toBe("DC 9");
  });

  it("resolves dc:CON -> DC 10", () => {
    expect(resolveFormulaTag("dc", "CON", abilities, profBonus)).toBe("DC 10");
  });

  it("returns static values unchanged", () => {
    expect(resolveFormulaTag("atk", "+5", abilities, profBonus)).toBe("+5");
    expect(resolveFormulaTag("damage", "2d8+3", abilities, profBonus)).toBe("2d8+3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formula-tags.test.ts`
Expected: FAIL

- [ ] **Step 3: Extend the InlineTag type**

Modify `src/parsers/inline-tag-parser.ts` to add an optional `formula` field:

```typescript
// src/parsers/inline-tag-parser.ts
export type InlineTagType = "dice" | "damage" | "dc" | "atk" | "mod" | "check";

export interface FormulaRef {
  ability: string; // "str", "dex", "con", "int", "wis", "cha"
  kind: "attack" | "damage" | "dc";
}

export interface InlineTag {
  type: InlineTagType;
  content: string;
  formula?: FormulaRef | null;
}

const VALID_PREFIXES: InlineTagType[] = ["dice", "damage", "dc", "atk", "mod", "check"];

/** Aliases that map to a canonical tag type (avoids collision with Javalent's `dice:` prefix) */
const PREFIX_ALIASES: Record<string, InlineTagType> = {
  roll: "dice",
  d: "dice",
};

export function parseInlineTag(text: string): InlineTag | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return null;

  const prefix = text.slice(0, colonIndex).trim().toLowerCase();
  const resolved = PREFIX_ALIASES[prefix] ?? prefix;
  if (!VALID_PREFIXES.includes(resolved as InlineTagType)) return null;

  const content = text.slice(colonIndex + 1).trim();
  if (content.length === 0) return null;

  return { type: resolved as InlineTagType, content, formula: null };
}
```

- [ ] **Step 4: Write the formula-tags implementation**

```typescript
// src/dnd/formula-tags.ts
import type { FormulaRef } from "../parsers/inline-tag-parser";
import type { MonsterAbilities } from "../types/monster";
import { abilityModifier, attackBonus, saveDC, formatModifier } from "./math";
import { ABILITY_KEYS } from "./constants";

const ABILITY_PATTERN = /\b(STR|DEX|CON|INT|WIS|CHA)\b/i;

export function detectFormula(tagType: string, content: string): FormulaRef | null {
  if (tagType !== "atk" && tagType !== "damage" && tagType !== "dc") return null;

  const match = content.match(ABILITY_PATTERN);
  if (!match) return null;

  const ability = match[1].toLowerCase();
  if (!(ABILITY_KEYS as readonly string[]).includes(ability)) return null;

  const kind = tagType === "atk" ? "attack" : tagType === "dc" ? "dc" : "damage";
  return { ability, kind };
}

export function resolveFormulaTag(
  tagType: string,
  content: string,
  abilities: MonsterAbilities,
  profBonus: number,
): string {
  const formula = detectFormula(tagType, content);
  if (!formula) return content; // static value, return as-is

  const abilityScore = abilities[formula.ability as keyof MonsterAbilities];

  switch (formula.kind) {
    case "attack": {
      const bonus = attackBonus(abilityScore, profBonus);
      return formatModifier(bonus);
    }
    case "dc": {
      const dc = saveDC(abilityScore, profBonus);
      return `DC ${dc}`;
    }
    case "damage": {
      const mod = abilityModifier(abilityScore);
      // Replace the ability name with the modifier value
      return content.replace(ABILITY_PATTERN, mod >= 0 ? `+${mod}` : `${mod}`)
        // Clean up double + (e.g., "1d6++2" -> "1d6+2")
        .replace(/\+\+/g, "+")
        // Clean up +- (e.g., "1d6+-1" -> "1d6-1")
        .replace(/\+-/g, "-");
    }
    default:
      return content;
  }
}
```

- [ ] **Step 5: Add formula tag tests to inline-tag-parser.test.ts**

Append to `tests/inline-tag-parser.test.ts`:

```typescript
  it("parses roll: alias to dice type", () => {
    const tag = parseInlineTag("roll: 2d6+3");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("dice");
    expect(tag!.content).toBe("2d6+3");
  });

  it("parses d: alias to dice type", () => {
    const tag = parseInlineTag("d: 1d20");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("dice");
  });

  it("includes formula field as null by default", () => {
    const tag = parseInlineTag("atk: +5");
    expect(tag).not.toBeNull();
    expect(tag!.formula).toBeNull();
  });
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run tests/formula-tags.test.ts tests/inline-tag-parser.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/parsers/inline-tag-parser.ts src/dnd/formula-tags.ts tests/formula-tags.test.ts tests/inline-tag-parser.test.ts
git commit -m "feat: add formula tag detection and resolution (atk:DEX, damage:1d6+STR, dc:WIS)"
```

---

### Task 6: YAML Serializer

**Files:**
- Create: `src/dnd/yaml-serializer.ts`
- Create: `tests/yaml-serializer.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/yaml-serializer.test.ts
import { describe, it, expect } from "vitest";
import { editableToYaml } from "../src/dnd/yaml-serializer";
import { monsterToEditable } from "../src/dnd/editable-monster";
import type { Monster } from "../src/types/monster";
import * as yaml from "js-yaml";

const GOBLIN: Monster = {
  name: "Goblin", size: "Small", type: "Humanoid", alignment: "Neutral Evil",
  cr: "1/4",
  ac: [{ ac: 15, from: ["leather armor", "shield"] }],
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  saves: { dex: 4 },
  skills: { Stealth: 6 },
  senses: ["darkvision 60 ft."],
  passive_perception: 9,
  languages: ["Common", "Goblin"],
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("editableToYaml", () => {
  it("produces valid YAML that can be parsed back", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    expect(parsed.name).toBe("Goblin");
    expect(parsed.size).toBe("Small");
    expect(parsed.cr).toBe("1/4");
  });

  it("includes all non-empty fields", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    expect(yamlStr).toContain("name: Goblin");
    expect(yamlStr).toContain("size: Small");
    expect(yamlStr).toContain("ac:");
    expect(yamlStr).toContain("hp:");
    expect(yamlStr).toContain("abilities:");
    expect(yamlStr).toContain("actions:");
  });

  it("does not include EditableMonster-only fields (overrides, proficiencies, etc.)", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    expect(yamlStr).not.toContain("overrides");
    expect(yamlStr).not.toContain("saveProficiencies");
    expect(yamlStr).not.toContain("skillProficiencies");
    expect(yamlStr).not.toContain("activeSenses");
    expect(yamlStr).not.toContain("customSenses");
    expect(yamlStr).not.toContain("activeSections");
    expect(yamlStr).not.toContain("proficiencyBonus");
  });

  it("round-trips through parser", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    expect((parsed.abilities as Record<string, number>).dex).toBe(14);
    expect((parsed.hp as Record<string, unknown>).average).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/yaml-serializer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```typescript
// src/dnd/yaml-serializer.ts
import * as yaml from "js-yaml";
import type { EditableMonster } from "./editable-monster";
import { editableToMonster } from "./editable-monster";

export function editableToYaml(editable: EditableMonster): string {
  const monster = editableToMonster(editable);
  return yaml.dump(monster, {
    lineWidth: -1, // no line wrapping
    quotingType: '"',
    forceQuotes: false,
    sortKeys: false,
    noRefs: true,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/yaml-serializer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/dnd/yaml-serializer.ts tests/yaml-serializer.test.ts
git commit -m "feat: add YAML serializer for EditableMonster -> code fence content"
```

---

### Task 7: Edit Mode CSS

**Files:**
- Create: `src/styles/archivist-edit.css`
- Modify: `src/styles/archivist-dnd.css` (add multi-column CSS)

- [ ] **Step 1: Create the edit mode CSS file**

Create `src/styles/archivist-edit.css` containing all edit mode styles. Reference the mockup at `.superpowers/brainstorm/*/content/edit-mode-v8.html` for exact values. The CSS should include:

- Input styles (`.archivist-edit-input`, `.archivist-edit-input-name`, `.archivist-edit-select`)
- Custom number spinners (`.archivist-num-wrap`, `.archivist-num-in`, `.archivist-num-spin`)
- Kill native number spinners globally within stat blocks
- Auto-calculated value style (`.archivist-auto-value`) with click cursor
- Override asterisk (`.archivist-override-mark`)
- Highlight animation (`@keyframes archivist-highlight-update`)
- Proficiency toggle (`.archivist-prof-toggle`, `.proficient`, `.expertise`)
- Collapsible sections (`.archivist-coll-header`, `.archivist-coll-chevron`)
- Saves grid (`.archivist-saves-grid`, 3-column)
- Skills grid (`.archivist-skills-grid`, 2-column)
- Senses grid (`.archivist-senses-grid`, 2-column)
- Feature card (`.archivist-feat-card`, `.archivist-feat-card-x`)
- Feature inputs (`.archivist-feat-name-input`, `.archivist-feat-text-input`)
- Add button (`.archivist-add-btn`)
- Section dropdown (`.archivist-section-dropdown`)
- Tag autocomplete (`.archivist-tag-autocomplete`)
- Edit mode outline on stat block (`.archivist-monster-block.editing`)
- Save bar side buttons (`.archivist-side-btn-save`, `.archivist-side-btn-compendium`, `.archivist-side-btn-cancel`)

All colors use the existing CSS variables (`--d5e-parchment`, `--d5e-text-accent`, `--d5e-bar-fill`, `--d5e-border-tan`). No white backgrounds on focus. Dashed borders signal editability. Custom triangle spinners on all number inputs.

**This file will be approximately 400-500 lines.** The implementer should extract exact values from the v8 mockup HTML's `<style>` block, translating inline styles to proper CSS classes.

- [ ] **Step 2: Add multi-column CSS to archivist-dnd.css**

Append to `src/styles/archivist-dnd.css`:

```css
/* ═══ Multi-Column Layout ═══ */
.archivist-monster-block-wrapper.two-col {
  max-width: 800px;
}

.archivist-monster-block.two-col-flow {
  column-count: 2;
  column-gap: 16px;
  column-rule: 1px solid var(--d5e-border-tan);
}

.archivist-monster-block.two-col-flow .property-line,
.archivist-monster-block.two-col-flow .archivist-feature,
.archivist-monster-block.two-col-flow .abilities-block,
.archivist-monster-block.two-col-flow .stat-block-bar,
.archivist-monster-block.two-col-flow .archivist-feat-card {
  break-inside: avoid;
}

/* Side button: column toggle active state */
.archivist-block-column-btn.active {
  background: var(--d5e-bar-fill) !important;
  color: var(--d5e-parchment) !important;
}
```

- [ ] **Step 3: Import the edit CSS in the build**

The existing build concatenates CSS files. Add an `@import` or ensure `archivist-edit.css` is included in the build pipeline. Check `esbuild.config.mjs` and `styles.css` for the current CSS concatenation pattern and follow it.

- [ ] **Step 4: Build and verify no CSS errors**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add src/styles/archivist-edit.css src/styles/archivist-dnd.css
git commit -m "feat: add edit mode CSS and multi-column layout styles"
```

---

### Task 8: Side Button State Management

**Files:**
- Create: `src/edit/side-buttons.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/edit/side-buttons.ts
import { setIcon } from "obsidian";

export type SideButtonState = "default" | "editing" | "pending";

interface SideButtonConfig {
  state: SideButtonState;
  onEdit: () => void;
  onSave: () => void;
  onCompendium: () => void;
  onCancel: () => void;
  onColumnToggle: () => void;
  isColumnActive: boolean;
}

export function renderSideButtons(container: HTMLElement, config: SideButtonConfig): void {
  container.empty();
  container.addClass("archivist-side-btns");

  if (config.state === "pending") {
    // Save (green check)
    const saveBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-save" });
    setIcon(saveBtn, "check");
    saveBtn.setAttribute("aria-label", "Save Changes");
    saveBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onSave(); });

    // Compendium (book)
    const compBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-compendium" });
    setIcon(compBtn, "book-open");
    compBtn.setAttribute("aria-label", "Add to Compendium");
    compBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCompendium(); });

    // Cancel (x)
    const cancelBtn = container.createDiv({ cls: "archivist-side-btn archivist-side-btn-cancel" });
    setIcon(cancelBtn, "x");
    cancelBtn.setAttribute("aria-label", "Cancel");
    cancelBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onCancel(); });
  } else {
    // Column toggle
    const colBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-column-btn ${config.isColumnActive ? "active" : ""}`,
    });
    setIcon(colBtn, "columns");
    colBtn.setAttribute("aria-label", "Toggle Columns");
    colBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onColumnToggle(); });

    // Edit
    const editBtn = container.createDiv({
      cls: `archivist-side-btn archivist-block-edit-btn ${config.state === "editing" ? "active" : ""}`,
    });
    setIcon(editBtn, "pen-line");
    editBtn.setAttribute("aria-label", "Edit");
    editBtn.addEventListener("click", (e) => { e.stopPropagation(); config.onEdit(); });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/edit/side-buttons.ts
git commit -m "feat: add side button state management (default/editing/pending)"
```

---

### Task 9: Edit State Manager

**Files:**
- Create: `src/edit/edit-state.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/edit/edit-state.ts
import type { EditableMonster } from "../dnd/editable-monster";
import { monsterToEditable, editableToMonster } from "../dnd/editable-monster";
import { recalculate } from "../dnd/recalculate";
import { editableToYaml } from "../dnd/yaml-serializer";
import type { Monster } from "../types/monster";

export class MonsterEditState {
  private original: Monster;
  private _current: EditableMonster;
  private _hasPendingChanges = false;
  private onChange: (state: MonsterEditState) => void;

  constructor(monster: Monster, onChange: (state: MonsterEditState) => void) {
    this.original = monster;
    this._current = monsterToEditable(monster);
    this.onChange = onChange;
  }

  get current(): EditableMonster { return this._current; }
  get hasPendingChanges(): boolean { return this._hasPendingChanges; }

  updateField(field: string, value: unknown): void {
    // Set the field value using dot-notation path
    setNestedField(this._current, field, value);
    // Recalculate derived values
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  toggleSaveProficiency(ability: string): void {
    this._current.saveProficiencies[ability] = !this._current.saveProficiencies[ability];
    this._current = recalculate(this._current, `saves.${ability}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  cycleSkillProficiency(skill: string): void {
    const current = this._current.skillProficiencies[skill] ?? "none";
    const next = current === "none" ? "proficient" : current === "proficient" ? "expertise" : "none";
    this._current.skillProficiencies[skill] = next;
    this._current = recalculate(this._current, `skills.${skill}`);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  setOverride(field: string, value: number): void {
    this._current.overrides.add(field);
    setNestedField(this._current, field, value);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  clearOverride(field: string): void {
    this._current.overrides.delete(field);
    this._current = recalculate(this._current, field);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  addSection(section: string): void {
    if (!this._current.activeSections.includes(section)) {
      this._current.activeSections.push(section);
      // Initialize empty feature array for the section
      const key = sectionToMonsterKey(section);
      if (key && !(this._current as Record<string, unknown>)[key]) {
        (this._current as Record<string, unknown>)[key] = [];
      }
      this._hasPendingChanges = true;
      this.onChange(this);
    }
  }

  removeSection(section: string): void {
    this._current.activeSections = this._current.activeSections.filter(s => s !== section);
    this._hasPendingChanges = true;
    this.onChange(this);
  }

  toYaml(): string {
    return editableToYaml(this._current);
  }

  toMonster(): Monster {
    return editableToMonster(this._current);
  }

  cancel(): void {
    this._current = monsterToEditable(this.original);
    this._hasPendingChanges = false;
    this.onChange(this);
  }
}

function sectionToMonsterKey(section: string): string | null {
  const map: Record<string, string> = {
    traits: "traits", actions: "actions", reactions: "reactions",
    legendary: "legendary", "bonus actions": "bonus_actions",
    "legendary actions": "legendary", "lair actions": "lair_actions",
    "mythic actions": "mythic_actions",
  };
  return map[section.toLowerCase()] ?? null;
}

function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined || current[parts[i]] === null) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/edit/edit-state.ts
git commit -m "feat: add MonsterEditState manager with field updates, overrides, and section management"
```

---

### Task 10: Monster Edit Mode Renderer

**Files:**
- Create: `src/edit/monster-edit-render.ts`
- Modify: `src/renderers/monster-renderer.ts`
- Modify: `src/main.ts`

This is the largest task. The edit renderer creates all the edit mode DOM elements (inputs, grids, toggles, cards) and wires them to the `MonsterEditState`. The existing `renderMonsterBlock` gets a small modification to accept an optional edit mode flag.

- [ ] **Step 1: Create the edit renderer**

Create `src/edit/monster-edit-render.ts`. This file will be approximately 500-700 lines. It should:

1. Export `renderMonsterEditBlock(monster: Monster, el: HTMLElement, ctx: MarkdownPostProcessorContext, plugin: ArchivistPlugin): void`
2. Create a `MonsterEditState` from the parsed monster
3. Render the full edit UI inside `el`:
   - Name input (Libre Baskerville, small-caps, dashed border)
   - Size dropdown, Type input, two Alignment dropdowns
   - AC number input with custom spinner + source text input
   - HP auto-calculated value (clickable for override) + hit dice formula input
   - Speed number input with custom spinner
   - Ability score table with 6 custom spinner inputs + auto-calculated modifiers
   - Collapsible Saving Throws section (chevron left, 3-column grid, proficiency toggles)
   - Collapsible Skills section (chevron left, 2-column grid, proficiency toggles, calculated defaults)
   - Collapsible Senses section (standard senses with toggles + ranges, custom senses, + Add Custom Sense button)
   - Languages text input
   - CR dropdown + auto-calculated XP
   - Tab bar with + button for section management
   - Feature cards per tab with name input + textarea + X remove button
   - "+ Add Action/Trait/etc." button per tab
4. Wire every input change to `state.updateField()` which triggers recalculation
5. Wire proficiency toggles to `state.toggleSaveProficiency()` / `state.cycleSkillProficiency()`
6. On recalculation, update all auto-calculated DOM elements with new values + highlight animation
7. Call `renderSideButtons()` to manage side button state

The implementer should reference the mockup HTML at `.superpowers/brainstorm/*/content/edit-mode-v8.html` for exact DOM structure, CSS classes, and element hierarchy.

- [ ] **Step 2: Modify monster-renderer.ts to support edit mode**

Add an `editMode` parameter to `renderMonsterBlock`:

```typescript
// In src/renderers/monster-renderer.ts, modify the export:
export function renderMonsterBlock(monster: Monster, editMode = false): HTMLElement {
  // ... existing view-mode rendering code unchanged ...
  return wrapper;
}
```

The actual edit rendering will be handled by `monster-edit-render.ts`, called from `main.ts`.

- [ ] **Step 3: Wire into main.ts renderBlock**

Modify `src/main.ts` `renderBlock` method to:
1. Import `renderSideButtons` from `src/edit/side-buttons`
2. Import `renderMonsterEditBlock` from `src/edit/monster-edit-render`
3. After rendering the view mode block, add the side buttons container
4. Wire the edit button click to swap from view mode to edit mode rendering
5. Wire save button to use `ctx.getSectionInfo(el)` + `editor.replaceRange()` for YAML sync
6. Wire compendium button to create vault entity note

- [ ] **Step 4: Build and test manually**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/`

Test in Obsidian:
1. Create a monster code block
2. Verify view mode renders correctly
3. Click edit button -> verify edit UI appears
4. Change ability score -> verify saves/skills/HP recalculate
5. Click save -> verify YAML updates
6. Click cancel -> verify changes discarded

- [ ] **Step 5: Commit**

```bash
git add src/edit/monster-edit-render.ts src/renderers/monster-renderer.ts src/main.ts
git commit -m "feat: add monster edit mode with inline editing and auto-recalculation"
```

---

### Task 11: Tag Autocomplete

**Files:**
- Create: `src/edit/tag-autocomplete.ts`

- [ ] **Step 1: Write the implementation**

Create `src/edit/tag-autocomplete.ts` that:

1. Exports `attachTagAutocomplete(textarea: HTMLTextAreaElement, state: MonsterEditState): void`
2. Listens for backtick (`` ` ``) keypress in the textarea
3. On trigger, creates a dropdown positioned above the cursor with:
   - Grouped sections: Attack, Damage, Save DC, Static
   - Each item shows: tag template, description, live-calculated preview value
   - Preview values computed from `state.current` abilities and proficiency bonus
4. Keyboard navigation: arrow keys to move selection, Enter to insert, Escape to close
5. Type-to-filter: typing after backtick filters the dropdown items
6. On selection: inserts the full tag with closing backtick, positions cursor at placeholder
7. Dropdown uses `.archivist-tag-autocomplete` CSS class from `archivist-edit.css`

The implementer should reference the autocomplete mockup in section 3 of the v8 mockup HTML for exact DOM structure and groupings.

- [ ] **Step 2: Wire into monster-edit-render.ts**

In `monster-edit-render.ts`, after creating each feature textarea, call `attachTagAutocomplete(textarea, state)`.

- [ ] **Step 3: Build and test manually**

Deploy to Obsidian. Enter edit mode on a monster block. In an action textarea, type a backtick. Verify the autocomplete dropdown appears with live preview values. Select an option and verify insertion.

- [ ] **Step 4: Commit**

```bash
git add src/edit/tag-autocomplete.ts src/edit/monster-edit-render.ts
git commit -m "feat: add backtick autocomplete for formula tags in action text"
```

---

### Task 12: Multi-Column Toggle

**Files:**
- Create: `src/edit/multi-column.ts`
- Modify: `src/types/settings.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add settings**

Modify `src/types/settings.ts`:

```typescript
export interface ArchivistSettings {
  compendiumRoot: string;
  userEntityFolder: string;
  srdImported: boolean;
  ttrpgRootDir: string;
  externalContextPaths: string[];
  defaultMultiColumn: boolean;
  multiColumnThreshold: number;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  userEntityFolder: "me",
  srdImported: false,
  ttrpgRootDir: "/",
  externalContextPaths: [],
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
};
```

- [ ] **Step 2: Create multi-column module**

```typescript
// src/edit/multi-column.ts

export function applyColumnLayout(wrapper: HTMLElement, block: HTMLElement, twoCol: boolean): void {
  if (twoCol) {
    wrapper.addClass("two-col");
    block.addClass("two-col-flow");
  } else {
    wrapper.removeClass("two-col");
    block.removeClass("two-col-flow");
  }
}

export function shouldAutoTwoColumn(blockEl: HTMLElement, threshold: number): boolean {
  // Count approximate content lines by measuring child count in feature sections
  const features = blockEl.querySelectorAll(".archivist-feature, .archivist-feat-card");
  return features.length >= threshold;
}
```

- [ ] **Step 3: Wire column toggle into side buttons and renderBlock**

In `main.ts`, when rendering a monster block:
1. Check if the parsed YAML has a `columns: 2` field or if auto-threshold triggers
2. Pass `isColumnActive` to `renderSideButtons`
3. On column toggle click, call `applyColumnLayout` and persist `columns` field in the monster data

- [ ] **Step 4: Build and test manually**

Deploy to Obsidian. Create an Ancient Black Dragon stat block with many actions. Click the column toggle. Verify content flows into two columns. Click again to return to single column.

- [ ] **Step 5: Commit**

```bash
git add src/edit/multi-column.ts src/types/settings.ts src/main.ts
git commit -m "feat: add multi-column toggle with CSS column-count and auto-threshold setting"
```

---

### Task 13: Spell & Item Simple Edit Mode

**Files:**
- Create: `src/edit/spell-edit-render.ts`
- Create: `src/edit/item-edit-render.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create spell edit renderer**

Create `src/edit/spell-edit-render.ts` that renders a simple edit UI for spells:
- Name text input
- Level dropdown (0-9), School dropdown
- Casting Time, Range, Components, Duration text inputs
- Concentration, Ritual toggle checkboxes
- Description textarea (multi-line)
- At Higher Levels textarea
- Classes comma-separated input
- Same side button save/compendium/cancel flow as monsters
- Same bidirectional YAML sync using `ctx.getSectionInfo` + `editor.replaceRange`

No auto-calculate, no formula tags -- just simple field editing.

- [ ] **Step 2: Create item edit renderer**

Create `src/edit/item-edit-render.ts` that renders a simple edit UI for items:
- Name text input
- Type dropdown, Rarity dropdown
- Attunement toggle + condition text input
- Weight, Value number inputs with spinners
- Damage text input, Damage Type dropdown
- Properties comma-separated input
- Charges number input, Recharge text input
- Curse toggle
- Description textarea
- Same save flow as spells

- [ ] **Step 3: Wire into main.ts**

Add edit button and side buttons to spell and item blocks in the `renderBlock` method, same pattern as monsters but delegating to the simpler edit renderers.

- [ ] **Step 4: Build and test manually**

Deploy to Obsidian. Create spell and item code blocks. Click edit. Verify inputs appear. Change fields. Click save. Verify YAML updates.

- [ ] **Step 5: Commit**

```bash
git add src/edit/spell-edit-render.ts src/edit/item-edit-render.ts src/main.ts
git commit -m "feat: add simple edit mode for spell and item blocks"
```

---

### Task 14: Integration Test & Polish

**Files:**
- Modify: `src/renderers/renderer-utils.ts` (formula tag rendering in view mode)
- All files from previous tasks

- [ ] **Step 1: Update renderer-utils for formula tag resolution in view mode**

Modify `renderStatBlockTag` in `src/renderers/renderer-utils.ts` to accept an optional `EditableMonster` parameter. When present, resolve formula tags before rendering:

```typescript
// In renderStatBlockTag, before rendering the tag text:
import { detectFormula, resolveFormulaTag } from "../dnd/formula-tags";

// If monster context is available, resolve formula content
const formula = detectFormula(tag.type, tag.content);
let displayContent = tag.content;
if (formula && monster) {
  displayContent = resolveFormulaTag(tag.type, tag.content, monster.abilities!, monster.proficiencyBonus);
}
// Use displayContent for the text element and dice notation
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (constants, math, editable-monster, recalculate, formula-tags, yaml-serializer, existing tests)

- [ ] **Step 3: Full build and deploy**

```bash
npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/
```

- [ ] **Step 4: Manual integration test checklist**

Test in Obsidian:
1. Monster view mode renders correctly (no regressions)
2. Spell/item view mode renders correctly
3. Side buttons show on hover: `</>`, Columns, Edit, Trash
4. Click Edit -> edit UI appears with all sections
5. Change STR from 8 to 16 -> verify saves, skills, attack tags recalculate
6. Change CR from 1/4 to 5 -> verify proficiency, saves, skills, XP update
7. Change size from Small to Medium -> verify hit dice formula updates, HP recalculates
8. Click override on HP value -> type manual number -> asterisk appears -> changing CON does NOT change HP
9. Click asterisk -> HP returns to auto mode and recalculates
10. Toggle save proficiency -> verify save value updates
11. Cycle skill proficiency (none -> proficient -> expertise -> none) -> verify skill value updates
12. Add custom sense -> verify it appears
13. Click + tab -> add Legendary Actions -> verify tab appears
14. Type backtick in action textarea -> verify autocomplete dropdown with live previews
15. Select `atk:DEX` -> verify tag inserted with closing backtick
16. Click Save -> verify YAML code fence updates in editor
17. Click Add to Compendium -> verify entity note created in vault
18. Click Cancel -> verify all changes discarded
19. Click Column toggle -> verify two-column layout
20. Spell edit mode works (basic field editing + save)
21. Item edit mode works (basic field editing + save)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete stat block edit mode with formula tags, autocomplete, multi-column, and YAML sync"
```

---

## Deploy Command

After each build:
```bash
npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/
```
