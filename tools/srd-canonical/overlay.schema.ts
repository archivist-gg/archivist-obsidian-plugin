import { z } from "zod";
import { resourceSchema } from "../../src/shared/schemas/resource-schema";
import { choiceSchema } from "../../src/shared/schemas/choice-schema";

const actionCost = z.enum(["action", "bonus-action", "reaction", "free", "special"]);
const recharge = z.enum(["short-rest", "long-rest", "dawn", "dusk", "turn", "round", "custom"]);

const featureOverrideSchema = z.object({
  action_cost: actionCost.optional(),
  resources: z.array(resourceSchema).optional(),
  save: z.object({
    ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]),
    dc_formula: z.string(),
  }).optional(),
  damage: z.object({
    dice: z.string(),
    type: z.string(),
  }).optional(),
  recharge: recharge.optional(),
  trigger: z.string().optional(),
  spell: z.string().optional(),
  healing: z.object({ dice: z.string(), bonus: z.string().optional() }).optional(),
  choices: z.array(choiceSchema).optional(),
  noChoices: z.literal(true).optional(),
});

const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);

const startingEquipmentEntrySchema = z.union([
  z.object({ kind: z.literal("fixed"), items: z.array(z.string().min(1)).nonempty() }),
  z.object({ kind: z.literal("choice"), options: z.array(z.string().min(1)).nonempty() }),
  z.object({ kind: z.literal("gold"), amount: z.number().int().positive() }),
]);

const classOverrideSchema = z.object({
  skill_choices: z.object({ count: z.number().int().positive(), from: z.array(skillEnum).nonempty() }).optional(),
  starting_equipment: z.array(startingEquipmentEntrySchema).nonempty().optional(),
  subclass_level: z.number().int().min(1).max(20).optional(),
  subclass_feature_name: z.string().min(1).optional(),
  choices: z.array(choiceSchema).optional(),
}).strict();

const entityChoicesSchema = z.object({
  choices: z.array(choiceSchema).optional(),
}).strict();

const optionalFeatureKind = z.enum(["invocation", "fighting_style", "metamagic", "maneuver", "infusion"]);

export const overlaySchema = z.object({
  class_features: z.record(z.string(), featureOverrideSchema).optional(),
  race_traits: z.record(z.string(), featureOverrideSchema).optional(),
  feat_features: z.record(z.string(), featureOverrideSchema).optional(),
  background_features: z.record(z.string(), featureOverrideSchema).optional(),
  optional_feature_slugs: z.partialRecord(optionalFeatureKind, z.array(z.string())).optional(),
  classes: z.record(z.string(), classOverrideSchema).optional(),
  races: z.record(z.string(), entityChoicesSchema).optional(),
  backgrounds: z.record(z.string(), entityChoicesSchema).optional(),
});

export type Overlay = z.infer<typeof overlaySchema>;
