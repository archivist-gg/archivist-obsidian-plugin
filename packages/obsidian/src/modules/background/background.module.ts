import type { App } from "obsidian";
import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { BackgroundEntity } from "@archivist/dnd5e/background/background.types";
import { parseBackground } from "@archivist/dnd5e/background/background.parser";
import { renderBackgroundBlock } from "./background.renderer";

class BackgroundModule implements ArchivistModule {
  readonly id = "background";
  readonly codeBlockType = "background";
  readonly entityType = "background";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<BackgroundEntity> {
    return parseBackground(source);
  }

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

export const backgroundModule: ArchivistModule = new BackgroundModule();
