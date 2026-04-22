import { z } from "zod";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const skillEnum = z.enum([
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
]);

const featCategoryEnum = z.enum(["origin", "general", "fighting-style", "epic-boon"]);

export const choiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("skill"), count: z.number().int().positive(), from: z.array(skillEnum).optional() }),
  z.object({ kind: z.literal("skill-expertise"), count: z.number().int().positive(), from_proficient: z.boolean() }),
  z.object({ kind: z.literal("subclass") }),
  z.object({ kind: z.literal("feat"), category: featCategoryEnum.optional() }),
  z.object({ kind: z.literal("asi") }),
  z.object({
    kind: z.literal("ability-score"),
    count: z.number().int().positive(),
    pool: z.array(abilityEnum).optional(),
    each: z.number().int().positive(),
  }),
  z.object({ kind: z.literal("fighting-style"), from: z.array(z.string()).nonempty() }),
  z.object({ kind: z.literal("language"), count: z.number().int().positive(), exclude: z.array(z.string()).optional() }),
  z.object({ kind: z.literal("tool"), count: z.number().int().positive(), from: z.array(z.string()).optional() }),
  z.object({
    kind: z.literal("spell"),
    count: z.number().int().positive(),
    level: z.number().int().nonnegative().optional(),
    from_list: z.string().min(1),
  }),
]);

export type ChoiceInput = z.input<typeof choiceSchema>;
export type ChoiceOutput = z.output<typeof choiceSchema>;
