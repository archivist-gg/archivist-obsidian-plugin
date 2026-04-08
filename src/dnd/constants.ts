// src/dnd/constants.ts

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

export const ALL_CR_VALUES: string[] = [
  "0", "1/8", "1/4", "1/2",
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];

export const SIZE_HIT_DICE: Record<string, number> = {
  tiny: 4, small: 6, medium: 8, large: 10, huge: 12, gargantuan: 20,
};

export const ALL_SIZES: string[] = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

export const SKILL_ABILITY: Record<string, string> = {
  "acrobatics": "dex", "animal handling": "wis", "arcana": "int",
  "athletics": "str", "deception": "cha", "history": "int",
  "insight": "wis", "intimidation": "cha", "investigation": "int",
  "medicine": "wis", "nature": "int", "perception": "wis",
  "performance": "cha", "persuasion": "cha", "religion": "int",
  "sleight of hand": "dex", "stealth": "dex", "survival": "wis",
};

export const ALL_SKILLS: string[] = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics",
  "Deception", "History", "Insight", "Intimidation", "Investigation",
  "Medicine", "Nature", "Perception", "Performance", "Persuasion",
  "Religion", "Sleight of Hand", "Stealth", "Survival",
];

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export const ABILITY_NAMES: Record<string, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

export const DAMAGE_TYPES: string[] = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force",
  "Lightning", "Necrotic", "Piercing", "Poison",
  "Psychic", "Radiant", "Slashing", "Thunder",
];

export const DAMAGE_NONMAGICAL_VARIANTS: string[] = [
  "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks",
  "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks not made with Silvered Weapons",
  "Bludgeoning, Piercing, and Slashing from Nonmagical Attacks not made with Adamantine Weapons",
];

export const CONDITIONS: string[] = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
  "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
  "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

export const STANDARD_SENSES: string[] = ["Blindsight", "Darkvision", "Tremorsense", "Truesight"];

export const ALIGNMENT_ETHICAL: string[] = ["Lawful", "Neutral", "Chaotic", "Unaligned", "Any"];
export const ALIGNMENT_MORAL: string[] = ["Good", "Neutral", "Evil"];

export const ALL_SECTIONS: string[] = [
  "Traits", "Actions", "Reactions", "Bonus Actions",
  "Legendary Actions", "Lair Actions", "Mythic Actions",
];
