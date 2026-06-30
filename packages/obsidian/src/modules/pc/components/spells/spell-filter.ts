import type { SpellCandidate } from "./spell-access";
import type { Spell } from "@archivist/dnd5e/spell/spell.types";
import { abbrAbility } from "./spell-display";

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

export interface ChipItem<V> { label: string; value: V; }

export const SOURCES: ChipItem<SourceCat>[] = [
  { label: "5e", value: "2014" }, { label: "2024", value: "2024" },
];
export const SCHOOLS: ChipItem<string>[] = [
  { label: "Abj", value: "abjuration" }, { label: "Conj", value: "conjuration" },
  { label: "Div", value: "divination" }, { label: "Ench", value: "enchantment" },
  { label: "Evoc", value: "evocation" }, { label: "Illu", value: "illusion" },
  { label: "Necro", value: "necromancy" }, { label: "Trans", value: "transmutation" },
];
export const CAST_TIMES: ChipItem<CastTimeCat>[] = [
  { label: "Action", value: "action" }, { label: "Bonus", value: "bonus" },
  { label: "Reaction", value: "reaction" }, { label: "1 min+", value: "long" },
  { label: "Special", value: "special" },
];
export const RANGES: ChipItem<RangeCat>[] = [
  { label: "Self", value: "self" }, { label: "Touch", value: "touch" },
  { label: "Ranged", value: "ranged" }, { label: "Special", value: "special" },
];
export const DAMAGE_TYPES: ChipItem<string>[] = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
].map((d) => ({ label: d[0].toUpperCase() + d.slice(1), value: d }));
export const SAVES: ChipItem<string>[] = [
  { label: "STR", value: "str" }, { label: "DEX", value: "dex" }, { label: "CON", value: "con" },
  { label: "INT", value: "int" }, { label: "WIS", value: "wis" }, { label: "CHA", value: "cha" },
];

export interface FilterState {
  query: string;
  showAll: boolean;
  sources: Set<SourceCat>;
  levels: Set<number>;
  schools: Set<string>;
  castTimes: Set<CastTimeCat>;
  ranges: Set<RangeCat>;
  damages: Set<string>;
  saves: Set<string>;
  concentration: boolean;
  ritual: boolean;
  moreOpen: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
}

export function defaultFilters(): FilterState {
  return {
    query: "", showAll: false,
    sources: new Set(), levels: new Set(), schools: new Set(),
    castTimes: new Set(), ranges: new Set(), damages: new Set(), saves: new Set(),
    concentration: false, ritual: false,
    moreOpen: false, sortKey: "level", sortDir: "asc",
  };
}

const editionOf = (e: Spell): SourceCat | null =>
  e.edition === "2014" ? "2014" : e.edition === "2024" ? "2024" : null;

/** AND across groups, OR within each. Empty group = no constraint. Honest reads only. */
export function matchesFilters(c: SpellCandidate, f: FilterState): boolean {
  const e = c.entity;
  if (f.sources.size) { const ed = editionOf(e); if (!ed || !f.sources.has(ed)) return false; }
  if (f.levels.size && !f.levels.has(c.level)) return false;
  if (f.schools.size && !(e.school && f.schools.has(e.school.toLowerCase()))) return false;
  if (f.castTimes.size && !f.castTimes.has(castTimeCategory(e.casting_time))) return false;
  if (f.ranges.size && !f.ranges.has(rangeCategory(e.range))) return false;
  if (f.damages.size) {
    const types = (e.damage?.types ?? []).map((t) => t.toLowerCase());
    if (!types.some((t) => f.damages.has(t))) return false;
  }
  if (f.saves.size) {
    const ab = e.saving_throw?.ability;
    if (!(ab && f.saves.has(abbrAbility(ab).toLowerCase()))) return false;
  }
  if (f.concentration && !e.concentration) return false;
  if (f.ritual && !e.ritual) return false;
  return true;
}

/** Count of active sections living in the "More" panel (for the badge). */
export function activeFacetCount(f: FilterState): number {
  let n = 0;
  if (f.schools.size) n++;
  if (f.castTimes.size) n++;
  if (f.ranges.size) n++;
  if (f.damages.size) n++;
  if (f.saves.size) n++;
  if (f.concentration) n++;
  if (f.ritual) n++;
  return n;
}

/** Clear every filter facet (and search/all-classes) in place; keep sort + moreOpen. */
export function resetFacets(f: FilterState): void {
  f.query = ""; f.showAll = false;
  f.sources.clear(); f.levels.clear(); f.schools.clear();
  f.castTimes.clear(); f.ranges.clear(); f.damages.clear(); f.saves.clear();
  f.concentration = false; f.ritual = false;
}
