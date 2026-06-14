/** Read a numeric value from a (sub)class table column at a given level, trying
 *  each candidate key in order. Returns null when absent or non-numeric. Shared
 *  by spellcasting (Cantrips/Spells Known) and the pool engine (pick counts). */
export function readTableColumn(
  table: Record<number, { columns?: Record<string, string | number> }> | undefined,
  level: number,
  keys: string[],
): number | null {
  const cols = table?.[level]?.columns;
  if (!cols) return null;
  for (const k of keys) {
    const raw = cols[k];
    if (raw === undefined || raw === null) continue;
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}
