import { z } from "zod";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);

const proficiencyTri = z.enum(["none", "proficient", "expertise"]);

const equipmentEntrySchema = z.object({
  item: z.string().min(1),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
  qty: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const characterOverridesSchema = z.object({
  scores: z.partialRecord(abilityEnum, z.number().int()).optional(),
  saves: z.partialRecord(abilityEnum, z.object({
    bonus: z.number().int(),
    proficient: z.boolean().optional(),
  })).optional(),
  skills: z.partialRecord(skillEnum, z.object({
    bonus: z.number().int(),
    proficiency: proficiencyTri.optional(),
  })).optional(),
  passives: z.object({
    perception: z.number().int().optional(),
    investigation: z.number().int().optional(),
    insight: z.number().int().optional(),
  }).partial().optional(),
  hp: z.object({ max: z.number().int().positive().optional() }).optional(),
  ac: z.number().int().optional(),
  speed: z.number().int().optional(),
  initiative: z.number().int().optional(),
  spellcasting: z.object({
    saveDC: z.number().int().optional(),
    attackBonus: z.number().int().optional(),
  }).optional(),
}).default({});

const characterStateSchema = z.object({
  hp: z.object({
    current: z.number().int(),
    max: z.number().int(),
    temp: z.number().int().nonnegative(),
  }),
  hit_dice: z.record(z.string(), z.object({
    used: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })).default({}),
  spell_slots: z.record(z.coerce.number().int(), z.object({
    used: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })).default({}),
  concentration: z.string().nullable().default(null),
  conditions: z.array(z.string()).default([]),
  death_saves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }).optional(),
  inspiration: z.number().int().nonnegative().default(0),
  currency: z.object({
    cp: z.number().int().nonnegative(),
    sp: z.number().int().nonnegative(),
    ep: z.number().int().nonnegative(),
    gp: z.number().int().nonnegative(),
    pp: z.number().int().nonnegative(),
  }).optional(),
  attuned_items: z.array(z.string()).optional(),
});

const classEntrySchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  subclass: z.string().nullable().default(null),
  choices: z.record(z.coerce.number().int(), z.unknown()).default({}),
});

const spellOverrideSchema = z.object({
  slug: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).default({}),
});

export const characterSchema = z.object({
  name: z.string().min(1),
  edition: z.enum(["2014", "2024"]),
  alignment: z.string().optional(),
  race: z.string().nullable().default(null),
  subrace: z.string().nullable().default(null),
  background: z.string().nullable().default(null),
  class: z.array(classEntrySchema).min(1),
  abilities: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  ability_method: z.enum(["standard-array", "point-buy", "rolled", "manual"]),
  skills: z.object({
    proficient: z.array(skillEnum).default([]),
    expertise: z.array(skillEnum).default([]),
  }).default({ proficient: [], expertise: [] }),
  spells: z.object({
    known: z.array(z.string()).default([]),
    overrides: z.array(spellOverrideSchema).default([]),
  }).default({ known: [], overrides: [] }),
  equipment: z.array(equipmentEntrySchema).default([]),
  overrides: characterOverridesSchema,
  notes: z.string().optional(),
  defenses: z.object({
    resistances: z.array(z.string()).default([]),
    immunities: z.array(z.string()).default([]),
    vulnerabilities: z.array(z.string()).default([]),
    condition_immunities: z.array(z.string()).default([]),
  }).partial().optional(),
  state: characterStateSchema,
});

export type CharacterInput = z.input<typeof characterSchema>;
export type CharacterOutput = z.output<typeof characterSchema>;
