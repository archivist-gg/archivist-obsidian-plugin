import { z } from "zod";

// --------------------------------------------------------------------------
// Condition schemas - discriminated union with recursive any_of.
// --------------------------------------------------------------------------

import type { Condition } from "./item.conditions.types";

const tier1Conditions = [
  z.object({ kind: z.literal("no_armor") }),
  z.object({ kind: z.literal("no_shield") }),
  z.object({ kind: z.literal("wielding_two_handed") }),
  z.object({ kind: z.literal("is_class"), value: z.string() }),
  z.object({ kind: z.literal("is_race"), value: z.string() }),
  z.object({ kind: z.literal("is_subclass"), value: z.string() }),
] as const;

const tier2Conditions = [
  z.object({ kind: z.literal("vs_creature_type"), value: z.string() }),
  z.object({ kind: z.literal("vs_attack_type"), value: z.enum(["ranged", "melee"]) }),
  z.object({ kind: z.literal("on_attack_type"), value: z.enum(["ranged", "melee"]) }),
  z.object({ kind: z.literal("with_weapon_property"), value: z.string() }),
  z.object({ kind: z.literal("vs_spell_save") }),
] as const;

const tier3Conditions = [
  z.object({ kind: z.literal("lighting"), value: z.enum(["dim", "bright", "daylight", "darkness"]) }),
  z.object({ kind: z.literal("underwater") }),
  z.object({ kind: z.literal("movement_state"), value: z.enum(["flying", "swimming", "climbing", "mounted"]) }),
] as const;

const tier4Conditions = [
  z.object({ kind: z.literal("has_condition"), value: z.string() }),
  z.object({ kind: z.literal("is_concentrating") }),
  z.object({ kind: z.literal("bloodied") }),
] as const;

const rawCondition = z.object({ kind: z.literal("raw"), text: z.string() });

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    ...tier1Conditions,
    ...tier2Conditions,
    ...tier3Conditions,
    ...tier4Conditions,
    rawCondition,
    z.object({ kind: z.literal("any_of"), conditions: z.array(conditionSchema) }),
  ]),
);

const conditionalBonusSchema = z.object({
  value: z.number().int(),
  when: z.array(conditionSchema),
});

// Bonuses can arrive as a number (variant pipeline emits +1 weapon → 1),
// a signed-integer string ("+3" / "-1" from structured-rules), or a
// conditional object. Schema accepts all three; pattern-guarded string
// keeps it from being a free-form passthrough.
const signedIntString = z.string().regex(/^[+-]?\d+$/);
const numberOrConditional = z.union([z.number().int(), signedIntString, conditionalBonusSchema]);

const bonusesSchema = z.object({
  ac: numberOrConditional.optional(),
  weapon_attack: numberOrConditional.optional(),
  weapon_damage: numberOrConditional.optional(),
  spell_attack: numberOrConditional.optional(),
  spell_save_dc: numberOrConditional.optional(),
  saving_throws: numberOrConditional.optional(),
  ability_scores: z.object({
    // partial: each ability is independently optional. z.record(enum, …) in
    // Zod v4 treats every enum key as required, which doesn't match the
    // data (e.g. Amulet of Health only sets `con: 19`).
    static: z.object({
      str: z.number().int().optional(),
      dex: z.number().int().optional(),
      con: z.number().int().optional(),
      int: z.number().int().optional(),
      wis: z.number().int().optional(),
      cha: z.number().int().optional(),
    }).optional(),
    bonus: z.object({
      str: numberOrConditional.optional(),
      dex: numberOrConditional.optional(),
      con: numberOrConditional.optional(),
      int: numberOrConditional.optional(),
      wis: numberOrConditional.optional(),
      cha: numberOrConditional.optional(),
    }).optional(),
  }).optional(),
  speed: z.object({
    walk: numberOrConditional.optional(),
    fly: z.union([numberOrConditional, z.literal("walk")]).optional(),
    swim: numberOrConditional.optional(),
    climb: numberOrConditional.optional(),
  }).optional(),
});

const chargesSchema = z.object({
  max: z.number().int(),
  recharge: z.string().optional(),
  recharge_amount: z.string().optional(),
  destroy_on_empty: z.object({
    roll: z.string(),
    threshold: z.number().int(),
    effect: z.string().optional(),
  }).optional(),
});

const attachedSpellsSchema = z.object({
  charges: z.record(z.string(), z.array(z.string())).optional(),
  daily: z.record(z.string(), z.array(z.string())).optional(),
  will: z.array(z.string()).optional(),
  rest: z.record(z.string(), z.array(z.string())).optional(),
});

const attunementTagSchema = z.union([
  z.object({ class: z.string(), subclass: z.string().optional() }),
  // alignment can be a single string OR an array of alignment-letter codes
  // (e.g. ["G"] for good, ["L", "G"] for lawful good).
  z.object({ alignment: z.union([z.string(), z.array(z.string())]) }),
  z.object({ race: z.string() }),
  z.object({ creature_type: z.string() }),
  z.object({ spellcasting: z.boolean() }),
]);

const attunementCanonicalSchema = z.object({
  required: z.boolean(),
  restriction: z.string().optional(),
  tags: z.array(attunementTagSchema).optional(),
});

const grantsSchema = z.object({
  proficiency: z.boolean().optional(),
  languages: z.union([z.boolean(), z.array(z.string())]).optional(),
  senses: z.object({
    darkvision: z.number().optional(),
    tremorsense: z.number().optional(),
    truesight: z.number().optional(),
    blindsight: z.number().optional(),
  }).optional(),
});

const containerSchema = z.object({
  capacity_weight: z.number().optional(),
  weightless: z.boolean().optional(),
  pack_contents: z.array(z.string()).optional(),
});

const lightSchema = z.object({
  bright_radius: z.number(),
  dim_radius: z.number(),
});

export const itemEntitySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  type: z.string().optional(),
  rarity: z.string().optional(),
  base_item: z.string().optional(),

  bonuses: bonusesSchema.optional(),
  resist: z.array(z.string()).optional(),
  immune: z.array(z.string()).optional(),
  vulnerable: z.array(z.string()).optional(),
  condition_immune: z.array(z.string()).optional(),

  charges: z.union([chargesSchema, z.number().int().nonnegative()]).optional(),
  attached_spells: attachedSpellsSchema.optional(),
  attunement: z.union([attunementCanonicalSchema, z.boolean(), z.string()]).optional(),
  grants: grantsSchema.optional(),
  container: containerSchema.optional(),
  light: lightSchema.optional(),

  cursed: z.boolean().optional(),
  sentient: z.boolean().optional(),
  focus: z.union([z.boolean(), z.string()]).optional(),
  tier: z.enum(["major", "minor"]).optional(),

  damage: z.union([
    z.object({
      dice: z.string(),
      type: z.string(),
      versatile_dice: z.string().optional(),
    }),
    z.string(),
  ]).optional(),
  weapon_category: z.string().optional(),
  armor_category: z.string().optional(),

  weight: z.union([z.number(), z.string()]).optional(),
  cost: z.string().optional(),
  source: z.string().optional(),
  page: z.number().int().optional(),
  edition: z.string().optional(),
  description: z.string().optional(),
  entries: z.array(z.unknown()).optional(),
  effects: z.array(z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),

  // Legacy fields preserved
  damage_dice: z.string().optional(),
  damage_type: z.string().optional(),
  properties: z.array(z.string()).optional(),
  recharge: z.string().optional(),
  curse: z.boolean().optional(),
});
