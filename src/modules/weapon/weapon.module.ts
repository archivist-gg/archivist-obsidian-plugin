import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { WeaponEntity } from "./weapon.types";
import { parseWeapon } from "./weapon.parser";
import { renderWeaponBlock } from "./weapon.renderer";

class WeaponModule implements ArchivistModule {
  readonly id = "weapon";
  readonly codeBlockType = "weapon";
  readonly entityType = "weapon";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<WeaponEntity> {
    return parseWeapon(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const weapon = data as WeaponEntity;
    const block = renderWeaponBlock(weapon);
    el.appendChild(block);
    return block;
  }
}

export const weaponModule: ArchivistModule = new WeaponModule();
