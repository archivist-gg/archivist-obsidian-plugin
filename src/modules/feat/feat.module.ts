import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { FeatEntity } from "./feat.types";
import { parseFeat } from "./feat.parser";
import { renderFeatStub } from "./feat.renderer";

class FeatModule implements ArchivistModule {
  readonly id = "feat";
  readonly codeBlockType = "feat";
  readonly entityType = "feat";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<FeatEntity> {
    return parseFeat(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderFeatStub(el, data as FeatEntity, ctx);
  }
}

export const featModule: ArchivistModule = new FeatModule();
