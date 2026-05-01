// src/srd/data/runtime/ holds canonical-pipeline runtime JSON output (not a
// code module); these permanent data imports live outside shared/ by design.
// Source: tools/srd-canonical/ pipeline (Open5e + 5etools merged).
import monsters2014 from "../../srd/data/runtime/monster.2014.json";
import monsters2024 from "../../srd/data/runtime/monster.2024.json";
import spells2014 from "../../srd/data/runtime/spell.2014.json";
import spells2024 from "../../srd/data/runtime/spell.2024.json";
import items2014 from "../../srd/data/runtime/item.2014.json";
import items2024 from "../../srd/data/runtime/item.2024.json";
import armor2014 from "../../srd/data/runtime/armor.2014.json";
import armor2024 from "../../srd/data/runtime/armor.2024.json";
import weapons2014 from "../../srd/data/runtime/weapon.2014.json";
import weapons2024 from "../../srd/data/runtime/weapon.2024.json";
import feats2014 from "../../srd/data/runtime/feat.2014.json";
import feats2024 from "../../srd/data/runtime/feat.2024.json";
import conditions2014 from "../../srd/data/runtime/condition.2014.json";
import conditions2024 from "../../srd/data/runtime/condition.2024.json";
import classes2014 from "../../srd/data/runtime/class.2014.json";
import classes2024 from "../../srd/data/runtime/class.2024.json";
import subclasses2014 from "../../srd/data/runtime/subclass.2014.json";
import subclasses2024 from "../../srd/data/runtime/subclass.2024.json";
import backgrounds2014 from "../../srd/data/runtime/background.2014.json";
import backgrounds2024 from "../../srd/data/runtime/background.2024.json";
import races2014 from "../../srd/data/runtime/race.2014.json";
import races2024 from "../../srd/data/runtime/race.2024.json";
import optionalFeatures2014 from "../../srd/data/runtime/optional-feature.2014.json";
import optionalFeatures2024 from "../../srd/data/runtime/optional-feature.2024.json";

export interface SrdEntity {
  slug: string;
  name: string;
  entityType: string;
  data: Record<string, unknown>;
}

export type SrdEntityType =
  | "monster"
  | "spell"
  | "item"
  | "armor"
  | "weapon"
  | "feat"
  | "condition"
  | "class"
  | "subclass"
  | "background"
  | "race"
  | "optional-feature";

export type SrdDataSources = Record<string, Record<string, unknown>[]>;

/**
 * Maps source-key (canonical kind) to canonical entity type strings.
 * The runtime JSON pipeline emits files keyed by canonical kind (e.g.
 * "monster", "item", "optional-feature"); some keys are normalized for the
 * store API (e.g. legacy "magicitems" -> "item"). New canonical kinds are
 * mapped 1:1 here.
 */
const TYPE_MAP: Record<string, SrdEntityType> = {
  // Legacy aliases (tests still pass plural keys via loadFromData()).
  monsters: "monster",
  spells: "spell",
  magicitems: "item",
  weapons: "weapon",
  feats: "feat",
  conditions: "condition",
  classes: "class",
  backgrounds: "background",
  // Canonical pipeline keys (singular).
  monster: "monster",
  spell: "spell",
  item: "item",
  armor: "armor",
  weapon: "weapon",
  feat: "feat",
  condition: "condition",
  class: "class",
  subclass: "subclass",
  background: "background",
  race: "race",
  "optional-feature": "optional-feature",
};

export class SrdStore {
  /** slug -> SrdEntity for O(1) lookup */
  private bySlug = new Map<string, SrdEntity>();
  /** entityType -> SrdEntity[] for type-scoped operations */
  private byType = new Map<string, SrdEntity[]>();

  /**
   * Load entities from a map of source-key -> raw JSON arrays.
   * Source keys are resolved through TYPE_MAP (e.g. "monster" -> "monster",
   * "magicitems" -> "item"). If a key is not in TYPE_MAP it is used as-is.
   */
  loadFromData(sources: SrdDataSources): void {
    this.bySlug.clear();
    this.byType.clear();

    for (const [sourceKey, items] of Object.entries(sources)) {
      const entityType = TYPE_MAP[sourceKey] ?? sourceKey;
      const bucket: SrdEntity[] = this.byType.get(entityType) ?? [];

      for (const raw of items) {
        const slug = (raw.slug as string) ?? "";
        const name = (raw.name as string) ?? "";
        const entity: SrdEntity = { slug, name, entityType, data: raw };
        this.bySlug.set(slug, entity);
        bucket.push(entity);
      }

      this.byType.set(entityType, bucket);
    }
  }

  /**
   * Load all bundled SRD JSON files from the canonical pipeline runtime.
   * Both 2014 and 2024 editions are merged into a single store; entities are
   * disambiguated by their edition-prefixed slugs (e.g. "srd-5e_aboleth" vs
   * "srd-2024_aboleth").
   */
  loadFromBundledJson(): void {
    // Each JSON import is statically inferred at varying depths by TypeScript;
    // we widen to the store's source shape via a single helper cast so the
    // SrdDataSources construction below stays straightforward.
    const asRows = (rows: unknown): Record<string, unknown>[] =>
      rows as Record<string, unknown>[];
    const sources: SrdDataSources = {
      monster: [...asRows(monsters2014), ...asRows(monsters2024)],
      spell: [...asRows(spells2014), ...asRows(spells2024)],
      item: [...asRows(items2014), ...asRows(items2024)],
      armor: [...asRows(armor2014), ...asRows(armor2024)],
      weapon: [...asRows(weapons2014), ...asRows(weapons2024)],
      feat: [...asRows(feats2014), ...asRows(feats2024)],
      condition: [...asRows(conditions2014), ...asRows(conditions2024)],
      class: [...asRows(classes2014), ...asRows(classes2024)],
      subclass: [...asRows(subclasses2014), ...asRows(subclasses2024)],
      background: [...asRows(backgrounds2014), ...asRows(backgrounds2024)],
      race: [...asRows(races2014), ...asRows(races2024)],
      "optional-feature": [
        ...asRows(optionalFeatures2014),
        ...asRows(optionalFeatures2024),
      ],
    };
    this.loadFromData(sources);
  }

  /**
   * O(1) lookup by slug.
   */
  getBySlug(slug: string): SrdEntity | undefined {
    return this.bySlug.get(slug);
  }

  /**
   * Ranked search: exact match > starts-with > contains.
   * Case-insensitive. Optionally filtered by entityType.
   */
  search(query: string, entityType?: string, limit = 20): SrdEntity[] {
    const q = query.toLowerCase();
    const pool = entityType
      ? (this.byType.get(entityType) ?? [])
      : Array.from(this.bySlug.values());

    const matches = pool
      .filter((e) => e.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        // Exact matches first
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;
        // Prefix matches second
        if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
        if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
        // Alphabetical tiebreak
        return aName.localeCompare(bName);
      });

    return matches.slice(0, limit);
  }

  /**
   * Return all entities of a given type.
   */
  getAllOfType(entityType: string): SrdEntity[] {
    return this.byType.get(entityType) ?? [];
  }

  /**
   * Return all registered entity type strings.
   */
  getTypes(): string[] {
    return Array.from(this.byType.keys());
  }

  /**
   * Total number of entities across all types.
   */
  count(): number {
    return this.bySlug.size;
  }

  // ---------------------------------------------------------------------------
  // Backward-compatible helpers (used by srd-tools.ts / MCP server)
  // ---------------------------------------------------------------------------

  /**
   * @deprecated Use getBySlug() instead. Kept for backward compatibility.
   * Exact name match (case-insensitive). Searches all types or a specific type.
   */
  getByName(name: string, entityType?: string): SrdEntity | null {
    const q = name.toLowerCase();
    const pool = entityType
      ? (this.byType.get(entityType) ?? [])
      : Array.from(this.bySlug.values());
    return pool.find((e) => e.name.toLowerCase() === q) ?? null;
  }
}
