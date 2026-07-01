import { z } from "zod";

export const npcInputSchema = z.object({
  role: z.string().optional().describe('e.g., "tavern keeper", "guard captain"'),
  race: z.string().optional().describe('e.g., "human", "elf", "dwarf"'),
  context: z.string().optional().describe('e.g., "works in the thieves guild in Valdros"'),
});
