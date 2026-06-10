import { z } from "zod";
import { CONDITION_SLUGS } from "./constants/conditions";

const conditionSlugEnum = z.enum(CONDITION_SLUGS);

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);

const proficiencyTri = z.enum(["none", "proficient", "expertise"]);

const slotEnum = z.enum(["mainhand", "offhand", "armor", "shield"]);

const equipmentEntryOverridesSchema = z.object({
  name: z.string().optional(),
  bonus: z.number().int().optional(),
  damage_bonus: z.number().int().optional(),
  extra_damage: z.string().optional(),
  ac_bonus: z.number().int().optional(),
  action: z.enum(["action", "bonus-action", "reaction", "free", "special"]).optional(),
  range: z.string().optional(),
}).strict();

const equipmentEntryStateSchema = z.object({
  charges: z.object({
    current: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  }).optional(),
  recovery: z.object({
    amount: z.string(),
    reset: z.enum(["dawn", "short", "long", "special"]),
  }).optional(),
  depletion_risk: z.object({
    trigger: z.string(),
    roll: z.string(),
    threshold: z.number().int(),
    effect: z.string(),
  }).optional(),
}).strict();

const equipmentEntrySchema = z.object({
  item: z.string().min(1),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
  qty: z.number().int().positive().optional(),
  notes: z.string().optional(),
  slot: slotEnum.nullable().optional(),
  overrides: equipmentEntryOverridesSchema.optional(),
  state: equipmentEntryStateSchema.optional(),
});

const characterOverridesSchema = z.object({
  scores: z.partialRecord(abilityEnum, z.number().int()).optional(),
  saves: z.partialRecord(abilityEnum, z.object({
    bonus: z.number().int().optional(),
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
  spell_slots: z.record(z.coerce.number().int(), z.number().int().nonnegative()).optional(),
  attunement_limit: z.number().int().nonnegative().optional(),
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
  spell_slots_pact: z.object({
    level: z.number().int().nonnegative(),
    used: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).optional(),
  concentration: z.string().nullable().default(null),
  conditions: z.array(conditionSlugEnum).default([]),
  exhaustion: z.number().int().min(0).max(6).default(0),
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
  feature_uses: z.record(z.string(), z.object({
    used: z.number().int().nonnegative(),
    max:  z.number().int().nonnegative(),
  })).default({}),
  attuned_items: z.array(z.string()).optional(),
});

// A persisted decision value: entity slug / inline value (string), multi-select
// slugs (string[]), or an ability-points / legacy record. The record arm is
// intentionally loose so no legacy value is ever dropped at parse time; readers
// narrow defensively.
const choiceValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.record(z.string(), z.unknown()),   // ability-points records + legacy oddities
]);

const classEntrySchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  subclass: z.string().nullable().default(null),
  choices: z.record(z.coerce.number().int(), z.record(z.string(), choiceValueSchema)).default({}),
});

const spellOverrideSchema = z.object({
  slug: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).default({}),
});

const knownSpellObjectSchema = z.object({
  spell: z.string().min(1),
  class: z.string().optional(),
  source: z.enum(["class", "feat", "item", "race", "domain"]).optional(),
  prepared: z.boolean().optional(),
  always_prepared: z.boolean().optional(),
}).strict();

const knownSpellEntrySchema = z.union([z.string().min(1), knownSpellObjectSchema]);

export const characterSchema = z.object({
  name: z.string().min(1),
  edition: z.enum(["2014", "2024"]),
  alignment: z.string().optional(),
  race: z.string().nullable().default(null),
  subrace: z.string().nullable().default(null),
  background: z.string().nullable().default(null),
  // Relaxed from .min(1) for build-in-progress drafts: the Builder is the only
  // producer of class-less files, and recalc degrades gracefully (HP/derivation
  // fall back with warnings) when no class is present. See SP2 spec §5/§9.
  class: z.array(classEntrySchema).default([]),
  // Race/background decision selections, keyed `race:<id>` / `background:<id>`
  // (SP2 Plan 3). Permissive value arm mirrors per-level class choices.
  origin_choices: z.record(z.string(), choiceValueSchema).default({}),
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
    known: z.array(knownSpellEntrySchema).default([]),
    overrides: z.array(spellOverrideSchema).default([]),
    view: z.enum(["by-level", "table"]).optional(),
  }).default({ known: [], overrides: [] }),
  equipment: z.array(equipmentEntrySchema).default([]),
  overrides: characterOverridesSchema,
  currency: z.object({
    cp: z.number().int().nonnegative(),
    sp: z.number().int().nonnegative(),
    ep: z.number().int().nonnegative(),
    gp: z.number().int().nonnegative(),
    pp: z.number().int().nonnegative(),
  }).optional(),
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
