import { z } from "zod";

export const npcInputSchema = z.object({
  role: z.string().optional().describe('e.g., "tavern keeper", "guard captain"'),
  race: z.string().optional().describe('e.g., "human", "elf", "dwarf"'),
  context: z.string().optional().describe('e.g., "works in the thieves guild in Valdros"'),
});

export const npcOutputSchema = z.object({
  name: z.string(),
  race: z.string(),
  role: z.string(),
  personality: z.string(),
  motivation: z.string(),
  secrets: z.string(),
  appearance: z.string(),
  voice: z.string(),
  connections: z.string(),
});

export const npcToolInput = { npc: npcInputSchema };
