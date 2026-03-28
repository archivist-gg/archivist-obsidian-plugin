import { z } from "zod";

export const spellInputSchema = z.object({
  name: z.string().describe("Spell name"),
  level: z.number().min(0).max(9).describe("Spell level (0 for cantrips)"),
  school: z.enum(["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]),
  casting_time: z.string().describe('e.g., "1 action", "1 bonus action"'),
  range: z.string().describe('e.g., "Touch", "120 feet", "Self"'),
  components: z.string().describe('e.g., "V, S", "V, S, M (diamond worth 100 gp)"'),
  duration: z.string().describe('e.g., "Instantaneous", "Concentration, up to 1 minute"'),
  description: z.array(z.string()).describe("Spell description paragraphs"),
  at_higher_levels: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional(),
});

export const spellToolInput = { spell: spellInputSchema };
