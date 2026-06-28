import { z } from "zod";
import { choiceSchema } from "@archivist/dnd5e/schemas/choice-schema";
import { startingEquipmentEntrySchema } from "@archivist/dnd5e/schemas/equipment-grant-schema";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const editionEnum = z.enum(["2014", "2024"]);
const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);
const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

const toolProfSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), items: z.array(z.string()).nonempty() }),
  z.object({
    kind: z.literal("choice"),
    count: z.number().int().positive(),
    from: z.array(z.string()).nonempty(),
  }),
]);

const langProfSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), languages: z.array(z.string()).nonempty() }),
  z.object({
    kind: z.literal("choice"),
    count: z.number().int().positive(),
    from: z.union([z.string(), z.array(z.string())]),
  }),
]);

const suggestedCharSchema = z.object({
  personality_traits: z.record(z.string(), z.string()).optional(),
  ideals: z.record(z.string(), z.object({
    name: z.string().optional(),
    desc: z.string(),
    alignment: z.string().optional(),
  })).optional(),
  bonds: z.record(z.string(), z.string()).optional(),
  flaws: z.record(z.string(), z.string()).optional(),
});

export const backgroundEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: editionEnum,
  source: z.string().min(1),
  description: z.string(),
  skill_proficiencies: z.array(skillEnum),
  tool_proficiencies: z.array(toolProfSchema),
  language_proficiencies: z.array(langProfSchema),
  equipment: z.array(startingEquipmentEntrySchema),
  feature: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
  }),
  ability_score_increases: z.object({
    pool: z.array(abilityEnum).length(3),
  }).nullable(),
  origin_feat: z.string().regex(wikilinkRegex).nullable(),
  suggested_characteristics: suggestedCharSchema.nullable(),
  choices: z.array(choiceSchema).optional(),
});
