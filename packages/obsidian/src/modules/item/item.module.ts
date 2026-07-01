import type { App } from "obsidian";
import type {
  ArchivistModule,
  CoreAPI,
  EditContext,
  ModalConstructor,
  ParseResult,
  RenderContext,
} from "../../core/module-api";
import type { Item } from "@archivist/dnd5e/item/item.types";
import { parseItem } from "@archivist/dnd5e/item/item.parser";
import { renderItemBlock } from "./item.renderer";
import { renderItemEditMode } from "./item.edit-render";
import { ItemModal } from "./item.modal";

// TODO(phase1): narrow RenderContext.plugin to a typed host-plugin handle
// so modules don't need to reach into src/main for the concrete class.
import type ArchivistPlugin from "../../main";

/**
 * The item module.
 *
 * This module is the self-contained home for every item-specific
 * concern: YAML parsing, read-mode rendering, edit-mode UI, and the
 * "Insert item" modal. (AI generation is owned by the dnd5e pack's
 * `itemGeneratable` + the generation bridge, not this module.)
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

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    const item = data as Item;
    const app = (ctx.plugin as { app?: App } | undefined)?.app;
    // Stable wrapper held by the host as `rendered`; the async renderer fills
    // it as a child instead of replacing it. If we used placeholder.replaceWith,
    // the host's `rendered` reference would point at a detached node after the
    // swap, and `rendered.remove()` in enterEditMode would no-op — leaving the
    // view block visible underneath the edit form.
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderItemBlock(item, app)
      .then((block) => { wrapper.appendChild(block); })
      .catch((err: unknown) => {
        console.error("[Archivist] item block render failed", err);
        wrapper.createDiv({
          cls: "archivist-block-error",
          text: `${(data as { name?: string })?.name ?? "Entity"} — block failed to render: ${String(err)}`,
        });
      });
    return wrapper;
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const item = data as Item;
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderItemEditMode>[2];
    renderItemEditMode(item, el, mdCtx, plugin, ctx.onExit, ctx.compendium, ctx.onReplaceRef);
  }

  getInsertModal(): ModalConstructor {
    // ItemModal's `(app, editor)` constructor satisfies ModalConstructor's
    // `new (app, ...never[]) => { open(): void }` shape directly — the rest
    // parameter is contravariant so any stricter tuple is assignable.
    return ItemModal;
  }
}

export const itemModule: ArchivistModule = new ItemModule();
