import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "../schemas/monster-schema";
import { spellInputSchema } from "../schemas/spell-schema";
import { itemInputSchema } from "../schemas/item-schema";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichMonster, enrichSpell, enrichItem } from "../validation/entity-enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  "Generate a D&D 5e monster stat block. Returns a validated and enriched monster object with auto-calculated XP, proficiency bonus, and ability modifiers. The stat block will be rendered visually in the chat.",
  { monster: monsterInputSchema },
  async ({ monster }) => {
    const enriched = enrichMonster(monster as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateSpellTool = tool(
  "generate_spell",
  "Generate a D&D 5e spell. Returns a validated spell object with auto-detected concentration and default classes. The spell will be rendered visually in the chat.",
  { spell: spellInputSchema },
  async ({ spell }) => {
    const enriched = enrichSpell(spell as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateItemTool = tool(
  "generate_item",
  "Generate a D&D 5e magic item. Returns a validated item object with normalized attunement and source fields. The item will be rendered visually in the chat.",
  { item: itemInputSchema },
  async ({ item }) => {
    const enriched = enrichItem(item as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }],
    };
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
