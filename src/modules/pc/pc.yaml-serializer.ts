import * as yaml from "js-yaml";
import type { Character } from "./pc.types";

/**
 * Serialize a Character struct back to a YAML string suitable for splicing
 * into the `pc` code block of a PC markdown file. Mirrors
 * `monster.yaml-serializer.ts`.
 */
export function characterToYaml(character: Character): string {
  // Strip migrated fields defensively. The parser already removes them, but
  // serialization is the last line of defense — never emit state.currency or
  // state.attuned_items even if upstream code re-introduces them.
  const cloned = JSON.parse(JSON.stringify(character)) as Character;
  delete (cloned.state as unknown as { currency?: unknown }).currency;
  delete (cloned.state as unknown as { attuned_items?: unknown }).attuned_items;
  // Ensure currency is emitted before state (parser migration may have appended
  // currency to the end of the object when lifting from state.currency).
  if (cloned.currency !== undefined) {
    const { state, ...rest } = cloned;
    const reordered = { ...rest, state } as Character;
    return yaml.dump(reordered, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false,
      noRefs: true,
    });
  }
  return yaml.dump(cloned, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    sortKeys: false,
    noRefs: true,
  });
}
