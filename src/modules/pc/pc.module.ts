import type { ArchivistModule, CoreAPI, ParseResult } from "../../core/module-api";
import type { Character } from "./pc.types";
import { parsePC } from "./pc.parser";
import { PCResolver } from "./pc.resolver";
import { ComponentRegistry } from "./components/component-registry";

export class PCModule implements ArchivistModule {
  readonly id = "pc";
  readonly codeBlockType = "pc";
  readonly entityType = "pc";

  core: CoreAPI | null = null;
  registry: ComponentRegistry = new ComponentRegistry();
  resolver: PCResolver | null = null;

  register(core: CoreAPI): void {
    this.core = core;
    this.resolver = new PCResolver(core.entities);
  }

  parseYaml(source: string): ParseResult<Character> {
    return parsePC(source);
  }
}

export const pcModule: ArchivistModule = new PCModule();
