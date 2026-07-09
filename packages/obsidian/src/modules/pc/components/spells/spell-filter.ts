import type { SpellCandidate } from "@archivist-gg/dnd5e/spell/spell.access";
import type { Spell } from "@archivist-gg/dnd5e/spell/spell.types";
import { abbrAbility } from "./spell-display";
import { castTimeCategory, rangeCategory } from "@archivist-gg/dnd5e/spell/spell.filter";
import type { CastTimeCat, RangeCat, SortKey, SortDir } from "@archivist-gg/dnd5e/spell/spell.filter";

export type SourceCat = "2014" | "2024";

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
