import type { EntityPresenter, RenderContext } from "../../shared/rendering/entity-presenter";
import type { WeaponEntity } from "@archivist/dnd5e/weapon/weapon.types";
import { renderWeaponBlock } from "./weapon.renderer";

class WeaponModule implements EntityPresenter {
  readonly type = "weapon";

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const weapon = data as WeaponEntity;
    const block = renderWeaponBlock(weapon);
    el.appendChild(block);
    return block;
  }
}

export const weaponModule: EntityPresenter = new WeaponModule();
