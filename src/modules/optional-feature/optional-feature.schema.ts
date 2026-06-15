import { z } from "zod";
import { featureEffectSchema } from "../../shared/schemas/feature-effect-schema";
import {
  resetTriggerEnum,
  actionCostEnum,
  resourceConsumptionSchema,
} from "../../shared/schemas/resource-schema";
import { durationSchema } from "../../shared/schemas/duration-schema";

const editionEnum = z.enum(["2014", "2024"]);
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
  feature_type: z.string().min(1),
  description: z.string(),
  prerequisites: z.array(prerequisiteSchema),
  available_to: z.array(z.string().regex(wikilinkRegex)),
  effects: z.array(featureEffectSchema),
  action_cost: actionCostEnum.nullable().optional(),
  uses: usesSchema.nullable().optional(),
  consumes: resourceConsumptionSchema.nullable().optional(),
  duration: durationSchema.nullable().optional(),
  passive: z.boolean().optional(),
  // Phase 3 activatable buffs: an activatable boon folds its effects only while
  // its slug is present in state.active_buffs (toggled in the PoolTab).
  activatable: z.boolean().optional(),
});

export type OptionalFeatureSchemaInput = z.input<typeof optionalFeatureEntitySchema>;
export type OptionalFeatureSchemaOutput = z.output<typeof optionalFeatureEntitySchema>;
