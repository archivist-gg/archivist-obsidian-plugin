import { z } from "zod";

export const itemInputSchema = z.object({
  name: z.string().describe("Item name"),
  type: z.enum(["weapon", "armor", "potion", "ring", "rod", "scroll", "staff", "wand", "wondrous item", "shield"]),
  rarity: z.enum(["common", "uncommon", "rare", "very rare", "legendary", "artifact"]),
  entries: z.array(z.string()).optional().describe("Item description and properties"),
  weight: z.number().optional(),
  value: z.number().optional(),
  attunement: z.union([z.boolean(), z.string()]).optional(),
  properties: z.array(z.string()).optional(),
  damage: z.string().optional(),
  damage_type: z.string().optional(),
  ac: z.number().optional(),
  charges: z.number().optional(),
  recharge: z.string().optional(),
  curse: z.boolean().optional(),
});

export const itemToolInput = { item: itemInputSchema };
