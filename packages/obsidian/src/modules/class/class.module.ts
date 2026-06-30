import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { ClassEntity } from "@archivist/dnd5e/class/class.types";
import { parseClass } from "@archivist/dnd5e/class/class.parser";
import { renderClassStub } from "./class.renderer";

class ClassModule implements ArchivistModule {
  readonly id = "class";
  readonly codeBlockType = "class";
  readonly entityType = "class";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<ClassEntity> {
    return parseClass(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderClassStub(el, data as ClassEntity, ctx);
  }
}

export const classModule: ArchivistModule = new ClassModule();
