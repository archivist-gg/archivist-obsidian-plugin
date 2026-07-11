import type { App } from "obsidian";
import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import { renderRaceBlock } from "./race.renderer";

class RaceModule implements EntityPresenter {
  readonly type = "race";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    // Stable wrapper held by the host; the async renderer fills it as a child
    // (same contract as the feat/spell modules — see feat.module.ts render()).
    const app = (ctx.plugin as { app?: App } | undefined)?.app;
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderRaceBlock(data as RaceEntity, app)
      .then((block) => { wrapper.appendChild(block); })
      .catch((err: unknown) => {
        console.error("[Archivist] race block render failed", err);
        wrapper.createDiv({
          cls: "archivist-block-error",
          text: `${(data as { name?: string })?.name ?? "Entity"} — block failed to render: ${String(err)}`,
        });
      });
    return wrapper;
  }
}

export const raceModule: EntityPresenter = new RaceModule();
