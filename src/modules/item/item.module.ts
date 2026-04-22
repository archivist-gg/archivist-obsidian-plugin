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

// TODO(phase1): narrow RenderContext.plugin to a typed host-plugin handle
// so modules don't need to reach into src/main for the concrete class.
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
    // No-op: item module is stateless; all wiring happens via the
    // generic code-block processor and compendium-ref registry lookups.
  }

  parseYaml(source: string): ParseResult<Item> {
    return parseItem(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const item = data as Item;
    const block = renderItemBlock(item);
    el.appendChild(block);
    return block;
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const item = data as Item;
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderItemEditMode>[2];
    renderItemEditMode(item, el, mdCtx, plugin, ctx.onExit, ctx.compendium, ctx.onReplaceRef);
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateItemTool.name,
      description: generateItemTool.description,
      schema: generateItemTool.inputSchema,
      execute: (input: unknown) => {
        const args = input as Parameters<typeof generateItemTool.handler>[0];
        return generateItemTool.handler(args, {});
      },
    });
    registry.registerSdkTool?.(generateItemTool);
  }

  getInsertModal(): ModalConstructor {
    // ItemModal's `(app, editor)` constructor satisfies ModalConstructor's
    // `new (app, ...never[]) => { open(): void }` shape directly — the rest
    // parameter is contravariant so any stricter tuple is assignable.
    return ItemModal;
  }
}

export const itemModule: ArchivistModule = new ItemModule();
