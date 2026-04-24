import * as yaml from "js-yaml";
import type { Character } from "./pc.types";

/**
 * Serialize a Character struct back to a YAML string suitable for splicing
 * into the `pc` code block of a PC markdown file. Mirrors
 * `monster.yaml-serializer.ts`.
 */
export function characterToYaml(character: Character): string {
  return yaml.dump(character, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    sortKeys: false,
    noRefs: true,
  });
}
