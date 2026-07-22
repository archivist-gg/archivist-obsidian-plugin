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

/** Per-compendium hidden state as parsed from `_compendium.md` (structural
 *  subset of Compendium). `hiddenDeclared` = the file carried an explicit
 *  boolean `hidden:` key. */
export interface CompendiumHiddenState {
  name: string;
  hidden: boolean;
  hiddenDeclared?: boolean;
}

export interface HiddenReconciliationPlan {
  /** Next settings value: always a FRESH array (the aliasing rule). */
  hiddenCompendiums: string[];
  /** True when membership differs from the current settings value. */
  settingsChanged: boolean;
  /** Compendiums whose `_compendium.md` needs `hidden: true` seeded (the
   *  field was absent but settings mark them hidden — one-time migration). */
  seedHidden: string[];
}

/** Load-time reconciliation between the durable per-file `hidden` field and
 *  `settings.hiddenCompendiums` (R3-P7 F4). Pure planner — callers apply:
 *  - file HAS a boolean `hidden` -> the FILE wins: settings membership synced;
 *  - field ABSENT + settings-hidden -> seed request (file gets hidden: true);
 *  - field ABSENT + visible -> nothing (no write on every load);
 *  - orphan settings entries (no matching compendium) are left untouched
 *    (the settings-tab's orphan rows own them). */
export function reconcileHiddenCompendiums(
  comps: readonly CompendiumHiddenState[],
  current: unknown,
): HiddenReconciliationPlan {
  const before = hiddenCompendiumSet({ hiddenCompendiums: current });
  const next = new Set(before);
  const seedHidden: string[] = [];

  for (const comp of comps) {
    if (comp.hiddenDeclared) {
      if (comp.hidden) next.add(comp.name);
      else next.delete(comp.name);
    } else if (next.has(comp.name)) {
      seedHidden.push(comp.name);
    }
  }

  const settingsChanged =
    next.size !== before.size || [...next].some((n) => !before.has(n));
  return { hiddenCompendiums: [...next], settingsChanged, seedHidden };
}
