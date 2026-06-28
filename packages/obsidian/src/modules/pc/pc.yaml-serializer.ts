import * as yaml from "js-yaml";
import type { Character } from "./pc.types";

const DUMP_OPTS = {
  lineWidth: -1,
  quotingType: '"' as const,
  forceQuotes: false,
  sortKeys: false,
  noRefs: true,
};

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
  // Strip via a single typed view that omits @deprecated markers (the
  // project's eslint config forbids disabling no-deprecated, and the
  // fields are still typed on CharacterState until Task 4 of SP5).
  const legacyState = cloned.state as { currency?: unknown; attuned_items?: unknown };
  delete legacyState.currency;
  delete legacyState.attuned_items;
  // NOTE: This reorder is a deviation from the plan body. After parser
  // migration lifts state.currency to definition.currency, JS object
  // insertion order puts `currency` LAST (after `state`). yaml.dump with
  // sortKeys: false preserves that order, so the emitted YAML has `state:`
  // before `currency:`. Test 4 requires currency-before-state. Splice
  // currency to the front by destructuring `state` off and re-spreading it
  // last.
  if (cloned.currency !== undefined) {
    const { state, ...rest } = cloned;
    return yaml.dump({ ...rest, state }, DUMP_OPTS);
  }
  return yaml.dump(cloned, DUMP_OPTS);
}
