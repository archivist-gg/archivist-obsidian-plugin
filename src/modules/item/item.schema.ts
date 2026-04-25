import { z } from "zod";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const bonusesSchema = z.object({
  ac: z.number().int().optional(),
  weapon_attack: z.number().int().optional(),
  weapon_damage: z.number().int().optional(),
  spell_attack: z.number().int().optional(),
  spell_save_dc: z.number().int().optional(),
  saving_throws: z.number().int().optional(),
  ability_scores: z.object({
    static: z.record(abilityEnum, z.number().int()).optional(),
    bonus: z.record(abilityEnum, z.number().int()).optional(),
  }).optional(),
  speed: z.object({
    walk: z.number().optional(),
    fly: z.union([z.number(), z.literal("walk")]).optional(),
    swim: z.number().optional(),
    climb: z.number().optional(),
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
  z.object({ alignment: z.string() }),
  z.object({ race: z.string() }),
  z.object({ creature_type: z.string() }),
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
  entries: z.array(z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),

  // Legacy fields preserved
  damage_dice: z.string().optional(),
  damage_type: z.string().optional(),
  properties: z.array(z.string()).optional(),
  recharge: z.string().optional(),
  curse: z.boolean().optional(),
}).loose();
