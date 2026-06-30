import type { App } from "obsidian";
import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { FeatEntity } from "@archivist/dnd5e/feat/feat.types";
import { parseFeat } from "@archivist/dnd5e/feat/feat.parser";
import { renderFeatBlock } from "./feat.renderer";

class FeatModule implements ArchivistModule {
  readonly id = "feat";
  readonly codeBlockType = "feat";
  readonly entityType = "feat";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<FeatEntity> {
    return parseFeat(source);
  }

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

export const featModule: ArchivistModule = new FeatModule();
