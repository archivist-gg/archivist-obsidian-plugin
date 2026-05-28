import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { BackgroundEntity } from "./background.types";
import { parseBackground } from "./background.parser";
import { renderBackgroundStub } from "./background.renderer";

class BackgroundModule implements ArchivistModule {
  readonly id = "background";
  readonly codeBlockType = "background";
  readonly entityType = "background";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<BackgroundEntity> {
    return parseBackground(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderBackgroundStub(el, data as BackgroundEntity, ctx);
  }
}

export const backgroundModule: ArchivistModule = new BackgroundModule();
