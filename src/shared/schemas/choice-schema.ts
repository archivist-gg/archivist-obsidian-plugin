import { z } from "zod";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const entityFilterSchema = z.object({
  feature_type: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  parent_class: z.literal("self").optional(),
  available_to: z.literal("self").optional(),
}).strict();

// FeatureEffect already has its own schema duties at the feature layer; here we
// accept the same shapes structurally (the canonical producer validates them).
const effectSchema = z.object({ kind: z.string().min(1) }).passthrough();

const inlineOptionSchema: z.ZodType = z.lazy(() => z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  effects: z.array(effectSchema).optional(),
  choices: z.array(choiceSchema).optional(),
}).strict());

export const choiceSchema: z.ZodType = z.lazy(() => z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("select-inline"),
    id: z.string().min(1),
    label: z.string().optional(),
    count: z.number().int().positive().optional(),
    options: z.array(inlineOptionSchema).nonempty(),
  }).strict(),
  z.object({
    kind: z.literal("select-entity"),
    id: z.string().min(1),
    label: z.string().optional(),
    count: z.number().int().positive().optional(),
    entity_type: z.string().min(1),
    from: z.array(z.string().min(1)).nonempty().optional(),
    where: entityFilterSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("select-proficiency"),
    id: z.string().min(1),
    label: z.string().optional(),
    count: z.number().int().positive(),
    domain: z.enum(["skill", "tool", "language", "save"]),
    from: z.array(z.string().min(1)).nonempty().optional(),
    from_proficient: z.boolean().optional(),
    expertise: z.boolean().optional(),
  }).strict(),
  z.object({
    kind: z.literal("ability-points"),
    id: z.string().min(1),
    label: z.string().optional(),
    points: z.number().int().positive(),
    max_per: z.number().int().positive(),
    pool: z.array(abilityEnum).nonempty().optional(),
  }).strict(),
]));

export type ChoiceInput = z.input<typeof choiceSchema>;
export type ChoiceOutput = z.output<typeof choiceSchema>;
