import { z } from "zod";

const actionCost = z.enum(["action", "bonus-action", "reaction", "free", "special"]);
const recharge = z.enum(["short-rest", "long-rest", "dawn", "dusk", "turn", "round", "custom"]);

const usesSchema = z.object({
  max: z.union([z.number(), z.string()]),
  recharge: recharge.optional(),
  scales_at: z.array(z.object({
    level: z.number().int().positive(),
    value: z.union([z.number(), z.string()]).optional(),
    max: z.union([z.number(), z.string()]).optional(),
  })).optional(),
});

const featureOverrideSchema = z.object({
  action_cost: actionCost.optional(),
  uses: usesSchema.optional(),
  save: z.object({
    ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]),
    dc_formula: z.string(),
  }).optional(),
  damage: z.object({
    dice: z.string(),
    type: z.string(),
  }).optional(),
  scales_at: z.array(z.object({
    level: z.number().int().positive(),
    damage: z.object({ dice: z.string() }).optional(),
    max: z.union([z.number(), z.string()]).optional(),
  })).optional(),
  recharge: recharge.optional(),
  trigger: z.string().optional(),
  spell: z.string().optional(),
  healing: z.object({ dice: z.string(), bonus: z.string().optional() }).optional(),
});

const optionalFeatureKind = z.enum(["invocation", "fighting_style", "metamagic", "maneuver", "infusion"]);

export const overlaySchema = z.object({
  class_features: z.record(z.string(), featureOverrideSchema).optional(),
  race_traits: z.record(z.string(), featureOverrideSchema).optional(),
  optional_feature_slugs: z.partialRecord(optionalFeatureKind, z.array(z.string())).optional(),
});

export type Overlay = z.infer<typeof overlaySchema>;
