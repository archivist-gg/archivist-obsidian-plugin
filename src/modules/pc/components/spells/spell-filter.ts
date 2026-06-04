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
