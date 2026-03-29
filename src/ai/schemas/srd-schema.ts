import { z } from "zod";

const srdEntityTypes = z.enum([
  "monster",
  "spell",
  "magic-item",
  "armor",
  "weapon",
  "feat",
  "condition",
  "class",
  "background",
]);

export const searchSrdInput = {
  query: z.string().describe("Name or partial name to search"),
  entity_type: srdEntityTypes.optional().describe("Filter by entity type"),
  limit: z.number().min(1).max(20).default(10).describe("Max results"),
};

export const getSrdEntityInput = {
  slug: z.string().describe("Entity slug (e.g. 'goblin', 'fireball', 'adamantine-armor')"),
  name: z.string().optional().describe("Fallback: exact or close-match entity name (used if slug lookup misses)"),
  entity_type: srdEntityTypes.optional().describe("Entity type (helps narrow name-based fallback)"),
};
