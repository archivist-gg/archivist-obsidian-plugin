import { z } from "zod";

export const spellInputSchema = z.object({
  name: z.string().describe("Spell name"),
  level: z.number().min(0).max(9).describe("Spell level (0 for cantrips)"),
  school: z.enum(["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]),
  casting_time: z.string().describe('e.g., "1 action", "1 bonus action"'),
  range: z.string().describe('e.g., "Touch", "120 feet", "Self"'),
  components: z.string().describe('e.g., "V, S", "V, S, M (diamond worth 100 gp)"'),
  duration: z.string().describe('e.g., "Instantaneous", "Concentration, up to 1 minute"'),
  description: z.array(z.string()).describe(
    "Spell description paragraphs. Use inline formula tags for damage and save DCs: " +
    "`damage:DICE` for damage rolls (e.g. `damage:8d6`), " +
    "`dc:ABILITY` for save DCs (e.g. `dc:WIS`). " +
    "Valid abilities: STR, DEX, CON, INT, WIS, CHA."
  ),
  at_higher_levels: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional(),
});

export const spellToolInput = { spell: spellInputSchema };
