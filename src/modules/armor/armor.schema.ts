import { z } from "zod";

const acSchema = z.object({
  base: z.number().int(),
  flat: z.number().int().default(0),
  add_dex: z.boolean().default(false),
  dex_max: z.number().int().nonnegative().optional(),
  add_con: z.boolean().default(false),
  add_wis: z.boolean().default(false),
  description: z.string().optional(),
});

export const armorEntitySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string(),
  ac: acSchema,
  strength_requirement: z.number().int().optional(),
  stealth_disadvantage: z.boolean().optional(),
  weight: z.union([z.number(), z.string()]).optional(),
  cost: z.string().optional(),
  rarity: z.string().optional(),
  source: z.string().optional(),
  page: z.number().int().optional(),
  edition: z.string().optional(),
  entries: z.array(z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
}).loose();
