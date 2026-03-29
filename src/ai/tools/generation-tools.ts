import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "../schemas/monster-schema";
import { spellInputSchema } from "../schemas/spell-schema";
import { itemInputSchema } from "../schemas/item-schema";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichMonster, enrichSpell, enrichItem } from "../validation/entity-enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  "Generate a D&D 5e monster stat block. Provide all fields in the structured format. Use 'abilities' for ability scores, 'entries' arrays for feature/action descriptions, arrays for senses/languages/immunities, and objects for ac/hp/speed.",
  { monster: monsterInputSchema },
  async ({ monster }) => {
    try {
      const enriched = enrichMonster(monster as Record<string, unknown>);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateSpellTool = tool(
  "generate_spell",
  "Generate a D&D 5e spell. Provide all fields in the structured format. Use 'description' as an array of paragraph strings, not a single string.",
  { spell: spellInputSchema },
  async ({ spell }) => {
    try {
      const enriched = enrichSpell(spell as Record<string, unknown>);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateItemTool = tool(
  "generate_item",
  "Generate a D&D 5e magic item. Provide all fields in the structured format. Use 'entries' as an array of description strings.",
  { item: itemInputSchema },
  async ({ item }) => {
    try {
      const enriched = enrichItem(item as Record<string, unknown>);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateEncounterTool = tool(
  "generate_encounter",
  "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  { encounter: encounterInputSchema },
  async ({ encounter }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "encounter", params: encounter }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateNpcTool = tool(
  "generate_npc",
  "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  { npc: npcInputSchema },
  async ({ npc }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "npc", params: npc }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);
