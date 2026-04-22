import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createSrdTools } from "./srd-tools";
import type { SrdStore } from "./srd-store";
import type { CompendiumManager } from "../entities/compendium-manager";

// Pull the exact shape `createSdkMcpServer` accepts for its `tools` param
// straight from the SDK's declared signature. This avoids both the `any[]`
// escape hatch (disallowed by the Obsidian plugin ESLint config) and the
// need to re-export the SDK's internal `SdkMcpToolDefinition` generic.
type SdkMcpServerToolsParam = NonNullable<
  Parameters<typeof createSdkMcpServer>[0]["tools"]
>;

/**
 * Build the in-process MCP server the inquiry chat uses for D&D tools.
 *
 * `moduleSdkTools` is the list of module-contributed SDK tool handles
 * (output of `tool()` from @anthropic-ai/claude-agent-sdk, collected by
 * main.ts from each ArchivistModule via `registerSdkTool`). The shared
 * tree no longer reaches into `src/modules/*` to import individual tools;
 * instead, callers pass in whatever the module registry has accumulated.
 */
export function createArchivistMcpServer(
  srdStore: SrdStore,
  compendiumManager?: CompendiumManager,
  moduleSdkTools: unknown[] = [],
) {
  const { searchSrdTool, getSrdEntityTool } = createSrdTools(srdStore);

  // Module-contributed SDK tool handles cross the shared boundary as
  // `unknown` (the shared tree doesn't import SDK-internal types from the
  // modules tree); assert them into the SDK's own parameter shape here at
  // the single SDK-adjacent site.
  const tools: SdkMcpServerToolsParam = [
    ...(moduleSdkTools as SdkMcpServerToolsParam),
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
