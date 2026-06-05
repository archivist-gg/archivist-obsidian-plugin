import { z } from "zod";
import { resourceSchema } from "../../src/shared/schemas/resource-schema";

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
});

const optionalFeatureKind = z.enum(["invocation", "fighting_style", "metamagic", "maneuver", "infusion"]);

export const overlaySchema = z.object({
  class_features: z.record(z.string(), featureOverrideSchema).optional(),
  race_traits: z.record(z.string(), featureOverrideSchema).optional(),
  feat_features: z.record(z.string(), featureOverrideSchema).optional(),
  background_features: z.record(z.string(), featureOverrideSchema).optional(),
  optional_feature_slugs: z.partialRecord(optionalFeatureKind, z.array(z.string())).optional(),
});

export type Overlay = z.infer<typeof overlaySchema>;
