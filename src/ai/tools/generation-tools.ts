import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as yamlLib from "js-yaml";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichMonster, enrichSpell, enrichItem } from "../validation/entity-enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  "Generate a D&D 5e monster stat block. Provide the complete monster data as YAML text (same format as ```monster code blocks in the vault).",
  { yaml: z.string().describe("Complete monster stat block as YAML") },
  async ({ yaml: yamlContent }) => {
    try {
      const parsed = yamlLib.load(yamlContent) as Record<string, unknown>;
      const enriched = enrichMonster(parsed);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateSpellTool = tool(
  "generate_spell",
  "Generate a D&D 5e spell. Provide the complete spell data as YAML text (same format as ```spell code blocks in the vault).",
  { yaml: z.string().describe("Complete spell data as YAML") },
  async ({ yaml: yamlContent }) => {
    try {
      const parsed = yamlLib.load(yamlContent) as Record<string, unknown>;
      const enriched = enrichSpell(parsed);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateItemTool = tool(
  "generate_item",
  "Generate a D&D 5e magic item. Provide the complete item data as YAML text (same format as ```item code blocks in the vault).",
  { yaml: z.string().describe("Complete item data as YAML") },
  async ({ yaml: yamlContent }) => {
    try {
      const parsed = yamlLib.load(yamlContent) as Record<string, unknown>;
      const enriched = enrichItem(parsed);
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
