import type { App } from "obsidian";
import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { FeatEntity } from "@archivist-gg/dnd5e/feat/feat.types";
import { renderFeatBlock } from "./feat.renderer";

class FeatModule implements EntityPresenter {
  readonly type = "feat";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    // Stable wrapper held by the host; the async renderer fills it as a child
    // (same contract as the spell module — see spell.module.ts render()).
    const app = (ctx.plugin as { app?: App } | undefined)?.app;
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderFeatBlock(data as FeatEntity, app)
      .then((block) => { wrapper.appendChild(block); })
      .catch((err: unknown) => {
        console.error("[Archivist] feat block render failed", err);
        wrapper.createDiv({
          cls: "archivist-block-error",
          text: `${(data as { name?: string })?.name ?? "Entity"} — block failed to render: ${String(err)}`,
        });
      });
    return wrapper;
  }
}

export const featModule: EntityPresenter = new FeatModule();
