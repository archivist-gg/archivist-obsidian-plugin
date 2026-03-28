import { z } from "zod";

export const searchSrdInput = {
  query: z.string().describe("Name or partial name to search"),
  entity_type: z.enum(["monster", "spell", "item"]).optional().describe("Filter by entity type"),
  cr_min: z.string().optional().describe("Minimum CR (monsters only)"),
  cr_max: z.string().optional().describe("Maximum CR (monsters only)"),
  level_min: z.number().optional().describe("Minimum level (spells only)"),
  level_max: z.number().optional().describe("Maximum level (spells only)"),
  school: z.string().optional().describe("Spell school filter"),
  rarity: z.string().optional().describe("Item rarity filter"),
  limit: z.number().min(1).max(20).default(5).describe("Max results"),
};

export const getSrdEntityInput = {
  name: z.string().describe("Exact or close-match entity name"),
  entity_type: z.enum(["monster", "spell", "item"]).describe("Entity type"),
};
