import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { SubclassEntity } from "@archivist-gg/dnd5e/subclass/subclass.types";
import { renderSubclassStub } from "./subclass.renderer";

class SubclassModule implements EntityPresenter {
  readonly type = "subclass";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderSubclassStub(el, data as SubclassEntity, ctx);
  }
}

export const subclassModule: EntityPresenter = new SubclassModule();
