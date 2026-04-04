import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  generateMonsterTool,
  generateSpellTool,
  generateItemTool,
  generateEncounterTool,
  generateNpcTool,
} from "./tools/generation-tools";
import { createSrdTools } from "./tools/srd-tools";
import type { SrdStore } from "./srd/srd-store";

export function createArchivistMcpServer(srdStore: SrdStore, compendiumManager?: any) {
  const { searchSrdTool, getSrdEntityTool } = createSrdTools(srdStore);

  const tools = [
    generateMonsterTool,
    generateSpellTool,
    generateItemTool,
    generateEncounterTool,
    generateNpcTool,
    searchSrdTool,
    getSrdEntityTool,
  ];

  if (compendiumManager) {
    const createCompendiumTool = tool(
      "create_compendium",
      "Create a new compendium for organizing D&D entities",
      {
        name: z.string().describe("Compendium name (used as folder name)"),
        description: z.string().optional().describe("Description of the compendium"),
        readonly: z.boolean().optional().describe("Whether the compendium is read-only (default: false)"),
        homebrew: z.boolean().optional().describe("Whether this is a homebrew compendium (default: true)"),
      },
      async ({ name, description, readonly, homebrew }) => {
        const desc = description ?? "";
        const isReadonly = readonly === true;
        const isHomebrew = homebrew !== false;
        try {
          await compendiumManager.create(name, desc, isHomebrew, isReadonly);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: true, name, description: desc, readonly: isReadonly, homebrew: isHomebrew }) }],
          };
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `Error: ${e.message}` }] };
        }
      },
    );
    tools.push(createCompendiumTool);
  }

  return createSdkMcpServer({
    name: "archivist",
    version: "1.0.0",
    tools,
  });
}
