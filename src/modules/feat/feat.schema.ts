import { z } from "zod";
import { choiceSchema } from "../../shared/schemas/choice-schema";
import { featureEffectSchema } from "../../shared/schemas/feature-effect-schema";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const editionEnum = z.enum(["2014", "2024"]);
const categoryEnum = z.enum(["origin", "general", "fighting-style", "epic-boon"]);

const prerequisiteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ability"), ability: abilityEnum, min: z.number().int().positive() }),
  z.object({ kind: z.literal("level"), min: z.number().int().positive() }),
  z.object({ kind: z.literal("spellcaster") }),
  z.object({
    kind: z.literal("proficiency"),
    proficiency_type: z.enum(["armor", "weapon", "tool", "skill", "saving-throw"]),
    value: z.string().min(1),
  }),
  z.object({ kind: z.literal("race"), slug: z.string().min(1) }),
  z.object({ kind: z.literal("class"), slug: z.string().min(1) }),
]);

export const featEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: editionEnum,
  source: z.string().min(1),
  category: categoryEnum,
  description: z.string(),
  prerequisites: z.array(prerequisiteSchema),
  benefits: z.array(z.string()),
  effects: z.array(featureEffectSchema),
  grants_asi: z.object({
    amount: z.number().int().positive(),
    pool: z.array(abilityEnum).optional(),
  }).nullable(),
  repeatable: z.boolean(),
  choices: z.array(choiceSchema),
});
