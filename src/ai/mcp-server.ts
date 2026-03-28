import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import {
  generateMonsterTool,
  generateSpellTool,
  generateItemTool,
  generateEncounterTool,
  generateNpcTool,
} from "./tools/generation-tools";
import { createSrdTools } from "./tools/srd-tools";
import type { SrdStore } from "./srd/srd-store";

export function createArchivistMcpServer(srdStore: SrdStore) {
  const { searchSrdTool, getSrdEntityTool } = createSrdTools(srdStore);

  return createSdkMcpServer({
    name: "archivist",
    version: "1.0.0",
    tools: [
      generateMonsterTool,
      generateSpellTool,
      generateItemTool,
      generateEncounterTool,
      generateNpcTool,
      searchSrdTool,
      getSrdEntityTool,
    ],
  });
}
