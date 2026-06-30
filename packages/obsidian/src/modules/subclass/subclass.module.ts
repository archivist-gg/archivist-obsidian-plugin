import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { SubclassEntity } from "@archivist/dnd5e/subclass/subclass.types";
import { parseSubclass } from "@archivist/dnd5e/subclass/subclass.parser";
import { renderSubclassStub } from "./subclass.renderer";

class SubclassModule implements ArchivistModule {
  readonly id = "subclass";
  readonly codeBlockType = "subclass";
  readonly entityType = "subclass";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<SubclassEntity> {
    return parseSubclass(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderSubclassStub(el, data as SubclassEntity, ctx);
  }
}

export const subclassModule: ArchivistModule = new SubclassModule();
