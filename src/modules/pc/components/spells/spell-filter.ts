import type { SpellCandidate } from "./spell-access";

export type SourceCat = "2014" | "2024";
export type CastTimeCat = "action" | "bonus" | "reaction" | "long" | "special";
export type RangeCat = "self" | "touch" | "ranged" | "special";

/** Cast-time bucket from the stored token (mirrors compactCastingTime's set).
 *  Rounds/minutes/hours fold into "long"; null/unknown → "special". */
export function castTimeCategory(token: string | undefined): CastTimeCat {
  switch (token) {
    case "action": return "action";
    case "bonus-action": return "bonus";
    case "reaction": return "reaction";
    case "minute": case "1minute": case "10minutes":
    case "hour": case "1hour": case "8hours": case "12hours": case "24hours":
      return "long";
    default: return "special";
  }
}

/** Range bucket from the human range string. Honest read, documented buckets:
 *  "Self…"→self, "Touch…"→touch, "<n> feet|ft"→ranged, else (mile/Sight/…)→special. */
export function rangeCategory(range: string | undefined): RangeCat {
  if (!range) return "special";
  if (/^self/i.test(range)) return "self";
  if (/^touch/i.test(range)) return "touch";
  if (/\d+\s*(feet|ft)\b/i.test(range)) return "ranged";
  return "special";
}

export type SortKey = "name" | "level" | "time" | "school" | "range" | "damage" | "save" | "source";
export type SortDir = "asc" | "desc";

const CAST_RANK: Record<CastTimeCat, number> = { action: 0, bonus: 1, reaction: 2, long: 3, special: 4 };
export function castTimeRank(token: string | undefined): number {
  return CAST_RANK[castTimeCategory(token)];
}

/** Numeric sort weight for a range string: Self=0, Touch=1, "<n> feet"=n, else large. */
export function rangeSortValue(range: string | undefined): number {
  if (!range) return 99999;
  if (/^self/i.test(range)) return 0;
  if (/^touch/i.test(range)) return 1;
  const m = range.match(/(\d+)\s*(feet|ft)\b/i);
  return m ? Number(m[1]) : 99999;
}

const EDITION_RANK: Record<string, number> = { "2014": 0, "2024": 1 };

/** localeCompare that sorts a present value before a missing one. */
function cmpMaybe(a: string | undefined, b: string | undefined): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

export function compareCandidates(a: SpellCandidate, b: SpellCandidate, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  let r = 0;
  switch (key) {
    case "name":   r = a.name.localeCompare(b.name); break;
    case "level":  r = a.level - b.level; break;
    case "time":   r = castTimeRank(a.entity.casting_time) - castTimeRank(b.entity.casting_time); break;
    case "school": r = cmpMaybe(a.entity.school, b.entity.school); break;
    case "range":  r = rangeSortValue(a.entity.range) - rangeSortValue(b.entity.range); break;
    case "damage": r = cmpMaybe(a.entity.damage?.types?.[0], b.entity.damage?.types?.[0]); break;
    case "save":   r = cmpMaybe(a.entity.saving_throw?.ability, b.entity.saving_throw?.ability); break;
    case "source": r = (EDITION_RANK[a.entity.edition ?? ""] ?? 9) - (EDITION_RANK[b.entity.edition ?? ""] ?? 9); break;
  }
  if (r === 0 && key !== "name") r = a.name.localeCompare(b.name); // stable tiebreak
  return r * mul;
}
