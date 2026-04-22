import type {
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
} from "../../core/module-api";
import { generateNpcTool } from "./npc.ai-tools";

/**
 * The NPC module.
 *
 * NPC is an AI-only module: it has a schema and an AI tool but no
 * code-block processor, parser, renderer, or edit UI. Generated NPCs
 * are materialized as regular markdown notes rather than code blocks,
 * so there's no `codeBlockType` and no `parseYaml` / `render` /
 * `renderEditMode` / `getInsertModal` to implement.
 *
 * Not yet wired into the plugin — Task 12 replaces the direct imports
 * in `main.ts` / `mcp-server.ts` with registry dispatch that flows
 * through `register()` here.
 */
class NpcModule implements ArchivistModule {
  readonly id = "npc";
  readonly entityType = "npc";

  register(_core: CoreAPI): void {
    // Task 12 populates this: the registry calls register() during
    // plugin load, and the module stashes any core handles it needs
    // for later callbacks. At Task 10 we only need the module to
    // type-check.
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateNpcTool.name,
      description: generateNpcTool.description,
      schema: generateNpcTool.inputSchema,
      execute: async (input: unknown) => {
        const args = input as Parameters<typeof generateNpcTool.handler>[0];
        return generateNpcTool.handler(args, {});
      },
    });
  }
}

export const npcModule: ArchivistModule = new NpcModule();
