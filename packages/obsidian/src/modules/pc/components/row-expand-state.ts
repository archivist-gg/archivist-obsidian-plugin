import type { ComponentRenderContext } from "./component.types";

// Per-row/block expand state lifted into the per-view `builderUiState` Map so it
// survives the whole-sheet re-render that every editState mutation fires (D1).
// Keys are namespaced `rowexpand.<surface>:<stableKey>`; the value is `true` when
// the row is open and ABSENT otherwise (deleted on collapse to keep the bag small).
const PREFIX = "rowexpand.";

type ExpandCtx = Pick<ComponentRenderContext, "builderUiState">;

/** Build a stable, namespaced expand key. Null/undefined parts coerce to "" so a
 *  key is byte-stable across a re-render of unchanged data (e.g. an absent
 *  entryIndex always yields the same trailing empty segment). */
export function rowExpandKey(
  surface: string,
  ...parts: Array<string | number | undefined | null>
): string {
  return PREFIX + [surface, ...parts.map((p) => (p == null ? "" : String(p)))].join(":");
}

/** True iff the row keyed by `key` is recorded open in the view's bag. Absent bag
 *  (legacy/test call sites without a threaded bag) reads as collapsed. */
export function isRowExpanded(ctx: ExpandCtx, key: string): boolean {
  return ctx.builderUiState?.get(key) === true;
}

/** Record open/closed. Open → set true; closed → DELETE (never store `false`), so
 *  a long session of open/close churn does not grow the bag. No-op without a bag. */
export function setRowExpanded(ctx: ExpandCtx, key: string, open: boolean): void {
  const bag = ctx.builderUiState;
  if (!bag) return;
  if (open) bag.set(key, true);
  else bag.delete(key);
}
