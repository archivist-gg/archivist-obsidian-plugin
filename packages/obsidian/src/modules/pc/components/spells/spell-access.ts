import type { EntityRegistry, RegisteredEntity } from "@archivist/core";
import type { Spell } from "@archivist/dnd5e/spell/spell.types";
import { baseClassName } from "../../pc.spellcasting";

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
  // Class slugs arrive compendium-qualified (e.g. `srd-5e_wizard`), but a spell's
  // `classes` list is bare (`wizard`) — normalize both sides to the bare name.
  const classSet = new Set(classSlugs.map((s) => baseClassName(s)));

  return all
    .filter((e) => !knownSlugs.has(e.slug))
    .map((e) => {
      const entity = e.data as unknown as Spell;
      return { slug: e.slug, name: e.name, entity, level: entity.level ?? 0 };
    })
    .filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (showAll) return true;
      const classes = (c.entity.classes ?? []).map((x) => baseClassName(x));
      const inClass = classes.some((x) => classSet.has(x));
      return inClass && c.level <= maxLevel;
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}
