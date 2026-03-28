import { z } from "zod";

export const encounterInputSchema = z.object({
  party_size: z.number().min(1).max(10).describe("Number of players"),
  party_level: z.number().min(1).max(20).describe("Average party level"),
  difficulty: z.enum(["easy", "medium", "hard", "deadly"]),
  environment: z.string().optional().describe('e.g., "swamp", "dungeon", "forest"'),
  theme: z.string().optional().describe('e.g., "undead horde", "dragon lair"'),
});

const encounterMonsterSchema = z.object({
  name: z.string(),
  cr: z.string(),
  count: z.number(),
  role: z.string(),
});

export const encounterOutputSchema = z.object({
  monsters: z.array(encounterMonsterSchema),
  tactics: z.string(),
  terrain: z.string(),
  notes: z.string(),
  xp_budget: z.object({
    target: z.number(),
    actual: z.number(),
    difficulty_rating: z.string(),
  }),
});

export const encounterToolInput = { encounter: encounterInputSchema };
