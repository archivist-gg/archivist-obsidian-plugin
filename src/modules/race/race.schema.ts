import { z } from "zod";
import { featureSchema } from "../../shared/schemas/feature-schema";

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const editionEnum = z.enum(["2014", "2024"]);
const sizeEnum = z.enum(["tiny", "small", "medium", "large", "huge"]);
const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

const speedSchema = z.object({
  walk: z.number().int().nonnegative().optional(),
  fly: z.number().int().nonnegative().optional(),
  swim: z.number().int().nonnegative().optional(),
  climb: z.number().int().nonnegative().optional(),
  burrow: z.number().int().nonnegative().optional(),
  hover: z.boolean().optional(),
});

const visionSchema = z.object({
  darkvision: z.number().int().nonnegative().optional(),
  blindsight: z.number().int().nonnegative().optional(),
  tremorsense: z.number().int().nonnegative().optional(),
  truesight: z.number().int().nonnegative().optional(),
});

const fixedAsiSchema = z.object({ ability: abilityEnum, amount: z.number().int() });
const choiceAsiSchema = z.object({
  choose: z.number().int().positive(),
  pool: z.array(abilityEnum).nonempty(),
  amount: z.number().int(),
});
const asiSchema = z.union([fixedAsiSchema, choiceAsiSchema]);

const languagesSchema = z.object({
  fixed: z.array(z.string()),
  choice: z.object({
    count: z.number().int().positive(),
    from: z.union([z.string(), z.array(z.string())]),
  }).optional(),
});

export const raceEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: editionEnum,
  source: z.string().min(1),
  description: z.string(),
  size: sizeEnum,
  speed: speedSchema,
  ability_score_increases: z.array(asiSchema),
  age: z.string(),
  alignment: z.string(),
  vision: visionSchema,
  languages: languagesSchema,
  variant_label: z.string().min(1),
  traits: z.array(featureSchema),
  subspecies_of: z.string().regex(wikilinkRegex).optional(),
});
