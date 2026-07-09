import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import { renderOptionalFeatureStub } from "./optional-feature.renderer";

class OptionalFeatureModule implements EntityPresenter {
  readonly type = "optional-feature";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderOptionalFeatureStub(el, data as OptionalFeatureEntity, ctx);
  }
}

export const optionalFeatureModule: EntityPresenter = new OptionalFeatureModule();
