import type { App } from "obsidian";
import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";
import { renderBackgroundBlock } from "./background.renderer";

class BackgroundModule implements EntityPresenter {
  readonly type = "background";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    // Stable wrapper held by the host; the async renderer fills it as a child
    // (same contract as the race/feat/spell modules — see race.module.ts render()).
    const app = (ctx.plugin as { app?: App } | undefined)?.app;
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderBackgroundBlock(data as BackgroundEntity, app)
      .then((block) => { wrapper.appendChild(block); })
      .catch((err: unknown) => {
        console.error("[Archivist] background block render failed", err);
        wrapper.createDiv({
          cls: "archivist-block-error",
          text: `${(data as { name?: string })?.name ?? "Entity"} — block failed to render: ${String(err)}`,
        });
      });
    return wrapper;
  }
}

export const backgroundModule: EntityPresenter = new BackgroundModule();
