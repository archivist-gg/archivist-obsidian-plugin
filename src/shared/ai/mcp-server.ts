import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createSrdTools } from "./srd-tools";
import type { SrdStore } from "./srd-store";
import type { CompendiumManager } from "../entities/compendium-manager";

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

  // The SDK's `tool()` returns an opaque `SdkMcpToolDefinition` shape; we
  // hold module-contributed tools as `unknown` at the boundary and widen
  // to `any[]` here so the array is assignment-compatible with the SDK's
  // tools param (which is itself heavily parameterised).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    ...moduleSdkTools,
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
