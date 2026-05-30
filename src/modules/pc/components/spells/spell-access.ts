import type { EntityRegistry, RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { Spell } from "../../../spell/spell.types";

export interface SpellCandidate {
  slug: string;
  name: string;
  level: number;
  entity: Spell;
}

/**
 * Pure spell-picker filter. Enumerates all `spell` entities from the registry
 * (an empty query returns every spell of the type), drops already-known slugs,
 * then applies the name search and — unless `showAll` is set — the class/level
 * gate. Results are sorted by level then name.
 */
export function classSpellCandidates(
  registry: EntityRegistry,
  classSlugs: string[],
  maxLevel: number,
  knownSlugs: Set<string>,
  showAll = false,
  query = "",
): SpellCandidate[] {
  const all: RegisteredEntity[] = registry.search(query, "spell", 1000);
  const q = query.toLowerCase();
  const classSet = new Set(classSlugs.map((s) => s.toLowerCase()));

  return all
    .filter((e) => !knownSlugs.has(e.slug))
    .map((e) => {
      const entity = e.data as unknown as Spell;
      return { slug: e.slug, name: e.name, entity, level: entity.level ?? 0 };
    })
    .filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (showAll) return true;
      const classes = (c.entity.classes ?? []).map((x) => x.toLowerCase());
      const inClass = classes.some((x) => classSet.has(x));
      return inClass && c.level <= maxLevel;
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
