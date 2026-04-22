import type {
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
} from "../../core/module-api";
import { generateEncounterTool } from "./encounter.ai-tools";

/**
 * The encounter module.
 *
 * Encounter is an AI-only module: it has a schema and an AI tool but
 * no code-block processor, parser, renderer, or edit UI. Generated
 * encounters surface as JSON payloads routed through the AI pipeline,
 * so there's no `codeBlockType` and no `parseYaml` / `render` /
 * `renderEditMode` / `getInsertModal` to implement.
 *
 * Not yet wired into the plugin — Task 12 replaces the direct imports
 * in `main.ts` / `mcp-server.ts` with registry dispatch that flows
 * through `register()` here.
 */
class EncounterModule implements ArchivistModule {
  readonly id = "encounter";
  readonly entityType = "encounter";

  register(_core: CoreAPI): void {
    // Task 12 populates this: the registry calls register() during
    // plugin load, and the module stashes any core handles it needs
    // for later callbacks. At Task 10 we only need the module to
    // type-check.
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateEncounterTool.name,
      description: generateEncounterTool.description,
      schema: generateEncounterTool.inputSchema,
      execute: async (input: unknown) => {
        const args = input as Parameters<typeof generateEncounterTool.handler>[0];
        return generateEncounterTool.handler(args, {});
      },
    });
    registry.registerSdkTool?.(generateEncounterTool);
  }
}

export const encounterModule: ArchivistModule = new EncounterModule();
