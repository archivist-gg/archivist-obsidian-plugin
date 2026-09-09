/**
 * R4-G6b §4.1 · structural deep equality over PARSED values, the one comparison every editor's no-op save guard
 * uses (invariant 11: an unchanged save writes nothing). Never a dirty flag: `MonsterEditState._hasPendingChanges`
 * stays true after an edit-then-revert, which is exactly the case this ruling covers.
 *
 * The five rules:
 * - objects compare by their own ENUMERABLE keys, key ORDER ignored;
 * - a key whose value is `undefined` is ignored on BOTH sides (js-yaml's `dump` omits it, so it can never reach a
 *   note either);
 * - arrays compare by length and by INDEX (an array is ordered data, so a reorder is a change);
 * - primitives compare by `===`, so `NaN` is never equal to itself (a numeric field that parsed to `NaN` is never
 *   silently treated as unchanged);
 * - `null` is distinct from `undefined` (an authored `key: null` is a value; an absent key is not).
 */
export function isUnchanged(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) return false;
    if (before.length !== after.length) return false;
    for (let i = 0; i < before.length; i++) {
      if (!isUnchanged(before[i], after[i])) return false;
    }
    return true;
  }
  if (before !== null && after !== null && typeof before === "object" && typeof after === "object") {
    const b = before as Record<string, unknown>;
    const a = after as Record<string, unknown>;
    const bKeys = definedKeys(b);
    const aKeys = new Set(definedKeys(a));
    if (bKeys.length !== aKeys.size) return false;
    for (const key of bKeys) {
      if (!aKeys.has(key)) return false;
      if (!isUnchanged(b[key], a[key])) return false;
    }
    return true;
  }
  return before === after;
}

/** The own enumerable keys that carry a value: an `undefined` key is ignored on both sides. */
function definedKeys(o: Record<string, unknown>): string[] {
  return Object.keys(o).filter((k) => o[k] !== undefined);
}
