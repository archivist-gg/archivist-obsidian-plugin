import { z } from "zod";
import { featureEffectSchema } from "../../shared/schemas/feature-effect-schema";
import { resetTriggerEnum, actionCostEnum } from "../../shared/schemas/resource-schema";

const editionEnum = z.enum(["2014", "2024"]);
const featureTypeEnum = z.enum([
  "invocation",
  "fighting_style",
  "metamagic",
  "maneuver",
  "infusion",
]);
const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

// Discriminated union mirrors OptionalFeaturePrerequisite in optional-feature.types.ts.
const prerequisiteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("level"), min: z.number().int().positive() }),
  z.object({ kind: z.literal("spell-known"), spell: z.string().regex(wikilinkRegex) }),
  z.object({ kind: z.literal("pact"), pact: z.enum(["tome", "blade", "chain", "talisman"]) }),
  z.object({ kind: z.literal("class"), class: z.string().regex(wikilinkRegex) }),
  z.object({ kind: z.literal("ability"), ability: abilityEnum, min: z.number().int().positive() }),
  z.object({ kind: z.literal("other"), detail: z.string() }),
]);

const usesSchema = z.object({
  max: z.union([z.number(), z.string()]),
  recharge: resetTriggerEnum,
});

export const optionalFeatureEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: editionEnum,
  source: z.string().min(1),
  feature_type: featureTypeEnum,
  description: z.string(),
  prerequisites: z.array(prerequisiteSchema),
  available_to: z.array(z.string().regex(wikilinkRegex)),
  effects: z.array(featureEffectSchema),
  action_cost: actionCostEnum.nullable().optional(),
  uses: usesSchema.nullable().optional(),
});

export type OptionalFeatureSchemaInput = z.input<typeof optionalFeatureEntitySchema>;
export type OptionalFeatureSchemaOutput = z.output<typeof optionalFeatureEntitySchema>;
