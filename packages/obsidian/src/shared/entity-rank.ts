import type { RegisteredEntity } from "@archivist-gg/core";

/**
 * Bounded name ranking over an entity pool (spec §8.3).
 *
 * Behaviourally identical to `EntityRegistry.search(query, undefined, limit)`
 * followed by a caller-side filter, but it never materialises or sorts the whole
 * pool: it keeps at most `limit` candidates in a small sorted buffer, so cost is
 * O(n · limit) with a constant-size allocation instead of O(n log n) over every
 * registered entity. That distinction is the whole point — a helper written on
 * top of `search(q, undefined, Infinity)` would still sort the full pool and be
 * a no-op.
 *
 * The pool a caller passes is `registry.getAllSlugs()` resolved through
 * `getBySlug()`. That is the SAME order core's untyped `search` enumerates
 * (`Array.from(this.bySlug.values())`) — both walk `bySlug` key order — which is
 * what makes the tie rule below equivalent to core's stable sort.
 *
 * FILTER: `name` contains `query`, case-insensitive (core's own filter).
 * SORT:   exact name > prefix > `localeCompare` (core's own comparator, copied
 *         verbatim so the two can never drift apart silently).
 * TIES:   pool order. A candidate is inserted only when it is STRICTLY better
 *         than the incumbent at a position, so the first entity seen wins every
 *         draw — exactly what a stable sort of the pool produces.
 *
 * `filter` runs BEFORE the cap, so filtered-out entities can never occupy a slot
 * and starve the ones the caller wanted (the hidden-compendium case).
 */
export function rankEntities(
  pool: Iterable<RegisteredEntity>,
  query: string,
  limit: number,
  filter?: (e: RegisteredEntity) => boolean,
): RegisteredEntity[] {
  if (!(limit > 0)) return [];
  const q = query.toLowerCase();
  const best: RegisteredEntity[] = [];
  // Lowercased names of `best`, parallel by index: the comparator reads them on
  // every probe, and lowercasing once per candidate keeps that off the hot path.
  const keys: string[] = [];

  for (const e of pool) {
    if (filter && !filter(e)) continue;
    const name = e.name.toLowerCase();
    if (!name.includes(q)) continue;

    // Full buffer and no better than the worst kept candidate: drop it. `>= 0`
    // (never `> 0`) is the tie rule — an equal candidate that arrived later must
    // not displace the incumbent.
    if (best.length >= limit && compareByRank(name, keys[keys.length - 1], q) >= 0) continue;

    // First index this candidate is STRICTLY better than; `keys` is sorted, so a
    // binary upper bound finds it. Landing AFTER every equal element is what
    // preserves pool order among ties.
    let lo = 0;
    let hi = best.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (compareByRank(name, keys[mid], q) < 0) hi = mid;
      else lo = mid + 1;
    }
    best.splice(lo, 0, e);
    keys.splice(lo, 0, name);
    if (best.length > limit) {
      best.pop();
      keys.pop();
    }
  }

  return best;
}

/** Core's `search` comparator, verbatim, over already-lowercased names.
 *  (`entity-registry.ts`: exact match first, prefix second, alphabetical last.)
 *
 *  The exact-match clause is REDUNDANT and known to be: an exact match is also a
 *  prefix match, and it is a strict prefix of every other prefix match, so
 *  `localeCompare` already sorts it first. It is kept because this is a copy of
 *  core's comparator and the two must not be able to drift; a mutation that
 *  deletes it is equivalent, not a gap in the tests. */
function compareByRank(aName: string, bName: string, q: string): number {
  if (aName === q && bName !== q) return -1;
  if (bName === q && aName !== q) return 1;
  if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
  if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
  return aName.localeCompare(bName);
}
