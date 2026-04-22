import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
// TODO(phase0-task13): generation-tools still bundles encounter/npc until
// those modules land. This cross-tree import closes then.
import {
  generateEncounterTool,
  generateNpcTool,
} from "../../ai/tools/generation-tools";
// TODO(phase0-task13): module registry will expose tools via the ArchivistModule
// interface; importing the monster tool directly is a transient shortcut.
import { generateMonsterTool } from "../../modules/monster/monster.ai-tools";
// TODO(phase0-task13): module registry will expose tools via the ArchivistModule
// interface; importing the spell tool directly is a transient shortcut.
import { generateSpellTool } from "../../modules/spell/spell.ai-tools";
// TODO(phase0-task13): module registry will expose tools via the ArchivistModule
// interface; importing the item tool directly is a transient shortcut.
import { generateItemTool } from "../../modules/item/item.ai-tools";
import { createSrdTools } from "./srd-tools";
import type { SrdStore } from "./srd-store";
import type { CompendiumManager } from "../entities/compendium-manager";

export function createArchivistMcpServer(srdStore: SrdStore, compendiumManager?: CompendiumManager) {
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
        } catch (e: unknown) {
          return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }] };
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
