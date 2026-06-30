import type { EntityType } from "@archivist/core";
import { raceCodec } from "./race.codec";

export const raceEntityType: EntityType = {
  type: "race",
  doc: raceCodec,
};
