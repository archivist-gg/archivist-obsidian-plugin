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
import type { Item } from "./item.types";
import { parseItem } from "./item.parser";
import { renderItemBlock } from "./item.renderer";
import { renderItemEditMode } from "./item.edit-render";
import { ItemModal } from "./item.modal";
import { generateItemTool } from "./item.ai-tools";

// TODO(phase0-task13): ArchivistPlugin typing will flow through
// ctx.plugin once the module registry wires plugin access generically.
import type ArchivistPlugin from "../../main";

/**
 * The item module.
 *
 * This module is the self-contained home for every item-specific
 * concern: YAML parsing, read-mode rendering, edit-mode UI, AI-tool
 * registration, and the "Insert item" modal.
 *
 * Not yet wired into the plugin — Task 12 replaces the direct imports
 * in `main.ts` / `compendium-ref-extension.ts` with registry dispatch
 * that flows through `register()` here.
 */
class ItemModule implements ArchivistModule {
  readonly id = "item";
  readonly codeBlockType = "item";
  readonly entityType = "item";

  register(_core: CoreAPI): void {
    // Task 12 populates this: the registry calls register() during
    // plugin load, and the module stashes any core handles (e.g. the
    // compendium manager) it needs for later callbacks. At Task 9 we
    // only need the module to type-check.
  }

  parseYaml(source: string): ParseResult<Item> {
    return parseItem(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): void {
    const item = data as Item;
    const block = renderItemBlock(item);
    el.appendChild(block);
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const item = data as Item;
    // ctx.plugin / ctx.ctx are typed as `unknown` on the interface;
    // the item edit-render currently needs the concrete plugin
    // type. Task 12 narrows this when the registry adds a typed
    // plugin accessor.
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderItemEditMode>[2];
    renderItemEditMode(item, el, mdCtx, plugin, ctx.onExit);
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateItemTool.name,
      description: generateItemTool.description,
      schema: generateItemTool.inputSchema,
      execute: async (input: unknown) => {
        const args = input as Parameters<typeof generateItemTool.handler>[0];
        return generateItemTool.handler(args, {});
      },
    });
  }

  getInsertModal(): ModalConstructor {
    // ItemModal's constructor is (app, editor); the ArchivistModule
    // contract widens the trailing args to `...unknown[]`, which is
    // compatible here.
    return ItemModal as unknown as new (app: App, editor: Editor) => unknown as ModalConstructor;
  }
}

export const itemModule: ArchivistModule = new ItemModule();
