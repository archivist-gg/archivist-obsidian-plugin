import { z } from "zod";
import { choiceSchema } from "./choice-schema";
import { resourceConsumptionSchema, resourceSchema } from "./resource-schema";
import { attackSchema } from "./attack-schema";
import { featureEffectSchema } from "./feature-effect-schema";

export const featureSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    entries: z.array(z.string()).optional(),
    choices: z.array(choiceSchema).optional(),
    grants_resource: z.string().optional(),
    consumes: resourceConsumptionSchema.optional(),
    attacks: z.array(attackSchema).optional(),
    action: z.enum(["action", "bonus-action", "reaction", "free", "special"]).optional(),
    trigger: z.string().optional(),
    dc_formula: z.string().optional(),
    effects: z.array(featureEffectSchema).optional(),
    sub_features: z.array(featureSchema).optional(),
    resources: z.array(resourceSchema).optional(),
  }).refine(
    (f) => f.description !== undefined || (f.entries !== undefined && f.entries.length > 0),
    { message: "feature requires either description or non-empty entries" }
  ),
);
