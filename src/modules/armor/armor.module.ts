import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { ArmorEntity } from "./armor.types";
import { parseArmor } from "./armor.parser";
import { renderArmorBlock } from "./armor.renderer";

class ArmorModule implements ArchivistModule {
  readonly id = "armor";
  readonly codeBlockType = "armor";
  readonly entityType = "armor";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<ArmorEntity> {
    return parseArmor(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const armor = data as ArmorEntity;
    const block = renderArmorBlock(armor);
    el.appendChild(block);
    return block;
  }
}

export const armorModule: ArchivistModule = new ArmorModule();
