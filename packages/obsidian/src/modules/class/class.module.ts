import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { ClassEntity } from "@archivist-gg/dnd5e/class/class.types";
import { renderClassStub } from "./class.renderer";

class ClassModule implements EntityPresenter {
  readonly type = "class";

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderClassStub(el, data as ClassEntity, ctx);
  }
}

export const classModule: EntityPresenter = new ClassModule();
