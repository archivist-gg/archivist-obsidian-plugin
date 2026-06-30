import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { OptionalFeatureEntity } from "@archivist/dnd5e/types/optional-feature.types";
import { parseOptionalFeature } from "@archivist/dnd5e/optional-feature/optional-feature.parser";
import { renderOptionalFeatureStub } from "./optional-feature.renderer";

class OptionalFeatureModule implements ArchivistModule {
  readonly id = "optional-feature";
  readonly codeBlockType = "optional-feature";
  readonly entityType = "optional-feature";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<OptionalFeatureEntity> {
    return parseOptionalFeature(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderOptionalFeatureStub(el, data as OptionalFeatureEntity, ctx);
  }
}

export const optionalFeatureModule: ArchivistModule = new OptionalFeatureModule();
