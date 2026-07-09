import type { App } from "obsidian";
import type {
  EditContext,
  EntityPresenter,
  ModalConstructor,
  RenderContext,
} from "../../shared/rendering/entity-presenter";
import type { Item } from "@archivist-gg/dnd5e/item/item.types";
import { renderItemBlock } from "./item.renderer";
import { renderItemEditMode } from "./item.edit-render";
import { ItemModal } from "./item.modal";

// The plugin cast below is the documented accepted seam (convention doc §6 /
// 0f spec §0.2): RenderContext.plugin stays `unknown`; edit renderers cast to
// the concrete plugin class via a type-only import.
import type ArchivistPlugin from "../../main";

/**
 * The item presenter: how an item is DRAWN — read-mode block, edit-mode UI,
 * and the "Insert item" modal. Parsing lives in the dnd5e pack codec; AI
 * generation lives in the pack's `itemGeneratable` + generation bridge.
 */
class ItemModule implements EntityPresenter {
  readonly type = "item";

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
    return ItemModal;
  }
}

export const itemModule: EntityPresenter = new ItemModule();
