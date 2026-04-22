import type { ArchivistModule, CoreAPI, ParseResult, RenderContext } from "../../core/module-api";
import type { RaceEntity } from "./race.types";
import { parseRace } from "./race.parser";
import { renderRaceStub } from "./race.renderer";

class RaceModule implements ArchivistModule {
  readonly id = "race";
  readonly codeBlockType = "race";
  readonly entityType = "race";

  register(_core: CoreAPI): void {}

  parseYaml(source: string): ParseResult<RaceEntity> {
    return parseRace(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    return renderRaceStub(el, data as RaceEntity, ctx);
  }
}

export const raceModule: ArchivistModule = new RaceModule();
