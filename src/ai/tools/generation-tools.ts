import { tool } from "@anthropic-ai/claude-agent-sdk";
import { spellInputSchema } from "../schemas/spell-schema";
import { itemInputSchema } from "../schemas/item-schema";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichSpell, enrichItem } from "../validation/entity-enrichment";

export const generateSpellTool = tool(
  "generate_spell",
  `Generate a D&D 5e spell. Provide all fields in the structured format. Use 'description' as an array of paragraph strings, not a single string.

In spell description text, use inline formula tags for damage and save DCs where applicable:
- \`damage:DICEdNOTATION\` for damage dice. Example: \`damage:8d6\`
- \`dc:ABILITY\` for save DCs (resolves to 8 + proficiency + ability mod of the caster). Example: \`dc:WIS\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example description entry: "Each creature in a 20-foot radius must make a \`dc:WIS\` Dexterity saving throw. A target takes \`damage:8d6\` fire damage on a failed save, or half as much on a success."`,
  { spell: spellInputSchema },
  ({ spell }) => {
    try {
      const enriched = enrichSpell(spell);
      return Promise.resolve({ content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }] });
    } catch (e) {
      return Promise.resolve({ content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true });
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateItemTool = tool(
  "generate_item",
  `Generate a D&D 5e magic item. Provide all fields in the structured format. Use 'entries' as an array of description strings.

In item 'entries' text, use inline formula tags for attack rolls, damage, and save DCs where applicable:
- \`atk:ABILITY\` for attack bonuses. Example: \`atk:STR\`
- \`damage:DICEdNOTATION+ABILITY\` for damage. Example: \`damage:1d8+STR\`
- \`dc:ABILITY\` for save DCs. Example: \`dc:CHA\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example entry: "On a hit, the target takes an extra \`damage:2d6\` fire damage."`,
  { item: itemInputSchema },
  ({ item }) => {
    try {
      const enriched = enrichItem(item);
      return Promise.resolve({ content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }] });
    } catch (e) {
      return Promise.resolve({ content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true });
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateEncounterTool = tool(
  "generate_encounter",
  "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  { encounter: encounterInputSchema },
  ({ encounter }) => {
    return Promise.resolve({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "encounter", params: encounter }),
      }],
    });
  },
  { annotations: { readOnlyHint: true } },
);

export const generateNpcTool = tool(
  "generate_npc",
  "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  { npc: npcInputSchema },
  ({ npc }) => {
    return Promise.resolve({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "npc", params: npc }),
      }],
    });
  },
  { annotations: { readOnlyHint: true } },
);
