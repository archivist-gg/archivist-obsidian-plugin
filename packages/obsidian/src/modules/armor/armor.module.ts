import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { ArmorEntity } from "@archivist-gg/dnd5e/armor/armor.types";
import { renderArmorBlock } from "./armor.renderer";

class ArmorModule implements EntityPresenter {
  readonly type = "armor";

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const armor = data as ArmorEntity;
    const block = renderArmorBlock(armor);
    el.appendChild(block);
    return block;
  }
}

export const armorModule: EntityPresenter = new ArmorModule();
