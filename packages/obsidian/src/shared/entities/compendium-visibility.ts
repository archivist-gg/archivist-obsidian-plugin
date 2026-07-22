/**
 * Single source of truth for compendium visibility (R3-P6). Hidden compendiums
 * are filtered out of every surface that enumerates content for picking NEW
 * things; resolution of already-referenced entities is never filtered, and
 * every filtered candidate list exempts the currently-selected slug(s).
 */

/** Structural settings shape: satisfied by ArchivistSettings, the narrow
 *  HostPlugin.settings, and test stubs alike. */
export interface CompendiumVisibilitySettings {
  hiddenCompendiums?: unknown;
}

const EMPTY: ReadonlySet<string> = new Set();

/** Fail-open: null/undefined settings, a missing key, or a corrupt value
 *  (non-array; non-string members are skipped) yield "nothing hidden". */
export function hiddenCompendiumSet(
  s: CompendiumVisibilitySettings | null | undefined,
): ReadonlySet<string> {
  const raw = s?.hiddenCompendiums;
  if (!Array.isArray(raw)) return EMPTY;
  const out = new Set<string>();
  for (const n of raw) if (typeof n === "string") out.add(n);
  return out;
}

export function isCompendiumVisible(name: string, hidden: ReadonlySet<string>): boolean {
  return !hidden.has(name);
}

/** For chip/tick lists rendered from CompendiumManager.getAll(). */
export function visibleCompendiums<T extends { name: string }>(
  comps: T[],
  hidden: ReadonlySet<string>,
): T[] {
  return comps.filter((c) => isCompendiumVisible(c.name, hidden));
}

/** Entity predicate. An entity with no compendium field is visible (fail-open). */
export function entityCompendiumVisible(
  e: { compendium?: string },
  hidden: ReadonlySet<string>,
): boolean {
  return e.compendium === undefined || !hidden.has(e.compendium);
}

/** Next hiddenCompendiums value for a settings toggle: always a FRESH deduped
 *  array (the aliasing rule); `visible: false` adds the name, `true` removes it.
 *  Tolerates a corrupt current value (treated as empty). */
export function withCompendiumVisibility(
  current: unknown,
  name: string,
  visible: boolean,
): string[] {
  const next = new Set(hiddenCompendiumSet({ hiddenCompendiums: current }));
  if (visible) next.delete(name);
  else next.add(name);
  return [...next];
}
