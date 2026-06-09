import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { FeatEntity } from "./feat.types";
import { parseFeat } from "./feat.parser";
import { renderFeatBlock } from "./feat.renderer";

class FeatModule implements ArchivistModule {
  readonly id = "feat";
  readonly codeBlockType = "feat";
  readonly entityType = "feat";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<FeatEntity> {
    return parseFeat(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    // Stable wrapper held by the host; the async renderer fills it as a child
    // (same contract as the spell module — see spell.module.ts render()).
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderFeatBlock(data as FeatEntity).then((block) => {
      wrapper.appendChild(block);
    });
    return wrapper;
  }
}

export const featModule: ArchivistModule = new FeatModule();
