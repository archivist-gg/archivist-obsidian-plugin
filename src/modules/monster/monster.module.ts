import type { App, Editor } from "obsidian";
import type {
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
  EditContext,
  ModalConstructor,
  ParseResult,
  RenderContext,
} from "../../core/module-api";
import type { Monster } from "./monster.types";
import { parseMonster } from "./monster.parser";
import { renderMonsterBlock } from "./monster.renderer";
import { renderMonsterEditMode } from "./edit/monster-edit-render";
import { MonsterModal } from "./monster.modal";
import { generateMonsterTool } from "./monster.ai-tools";

// TODO(phase0-task13): ArchivistPlugin typing will flow through
// ctx.plugin once the module registry wires plugin access generically.
import type ArchivistPlugin from "../../main";

/**
 * The monster module.
 *
 * This module is the self-contained home for every monster-specific
 * concern: YAML parsing, read-mode rendering, edit-mode UI, AI-tool
 * registration, and the "Insert monster" modal.
 *
 * Not yet wired into the plugin — Task 12 replaces the direct imports
 * in `main.ts` / `compendium-ref-extension.ts` with registry dispatch
 * that flows through `register()` here.
 */
class MonsterModule implements ArchivistModule {
  readonly id = "monster";
  readonly codeBlockType = "monster";
  readonly entityType = "monster";

  register(_core: CoreAPI): void {
    // Task 12 populates this: the registry calls register() during
    // plugin load, and the module stashes any core handles (e.g. the
    // compendium manager) it needs for later callbacks. At Task 8 we
    // only need the module to type-check.
  }

  parseYaml(source: string): ParseResult<Monster> {
    return parseMonster(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): void {
    const monster = data as Monster;
    const block = renderMonsterBlock(monster, monster.columns ?? 1);
    el.appendChild(block);
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const monster = data as Monster;
    // ctx.plugin / ctx.ctx are typed as `unknown` on the interface;
    // the monster edit-render currently needs the concrete plugin
    // type. Task 12 narrows this when the registry adds a typed
    // plugin accessor.
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderMonsterEditMode>[2];
    renderMonsterEditMode(monster, el, mdCtx, plugin);
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateMonsterTool.name,
      description: generateMonsterTool.description,
      schema: generateMonsterTool.inputSchema,
      execute: async (input: unknown) => {
        const args = input as Parameters<typeof generateMonsterTool.handler>[0];
        return generateMonsterTool.handler(args, {});
      },
    });
  }

  getInsertModal(): ModalConstructor {
    // MonsterModal's constructor is (app, editor); the ArchivistModule
    // contract widens the trailing args to `...unknown[]`, which is
    // compatible here.
    return MonsterModal as unknown as new (app: App, editor: Editor) => unknown as ModalConstructor;
  }
}

export const monsterModule: ArchivistModule = new MonsterModule();
