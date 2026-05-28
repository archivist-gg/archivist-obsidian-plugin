import { z } from "zod";

const conditionalPropertySchema = z.object({
  kind: z.literal("conditional"),
  uid: z.string(),
  note: z.string(),
});

const propertySchema = z.union([z.string(), conditionalPropertySchema]);

const editionEnum = z.enum(["2014", "2024"]);

export const weaponEntitySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  category: z.string(),
  damage: z.object({
    dice: z.string(),
    type: z.string(),
    versatile_dice: z.string().optional(),
  }),
  properties: z.array(propertySchema).default([]),
  range: z.object({
    normal: z.number().int().nonnegative(),
    long: z.number().int().nonnegative(),
  }).optional(),
  reload: z.number().int().nonnegative().optional(),
  mastery: z.array(z.string()).optional(),
  type_tags: z.array(z.string()).optional(),
  ammo_type: z.string().optional(),
  weight: z.union([z.number(), z.string()]).optional(),
  cost: z.string().optional(),
  source: z.string().optional(),
  page: z.number().int().optional(),
  edition: editionEnum,
  entries: z.array(z.unknown()).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
}).loose();
