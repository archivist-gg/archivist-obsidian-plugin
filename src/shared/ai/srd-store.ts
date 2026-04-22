// src/srd/data/ holds bundled SRD JSON assets (not a code module); these
// permanent data imports live outside shared/ by design.
import monstersJson from "../../srd/data/monsters.json";
import spellsJson from "../../srd/data/spells.json";
import magicitemsJson from "../../srd/data/magicitems.json";
import armorJson from "../../srd/data/armor.json";
import weaponsJson from "../../srd/data/weapons.json";
import featsJson from "../../srd/data/feats.json";
import conditionsJson from "../../srd/data/conditions.json";
import classesJson from "../../srd/data/classes.json";
import backgroundsJson from "../../srd/data/backgrounds.json";

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
  | "background";

export type SrdDataSources = Record<string, Record<string, unknown>[]>;

/**
 * Maps JSON file base-names (without .json) to canonical entity type strings.
 */
const TYPE_MAP: Record<string, SrdEntityType> = {
  monsters: "monster",
  spells: "spell",
  magicitems: "item",
  armor: "armor",
  weapons: "weapon",
  feats: "feat",
  conditions: "condition",
  classes: "class",
  backgrounds: "background",
};

export class SrdStore {
  /** slug -> SrdEntity for O(1) lookup */
  private bySlug = new Map<string, SrdEntity>();
  /** entityType -> SrdEntity[] for type-scoped operations */
  private byType = new Map<string, SrdEntity[]>();

  /**
   * Load entities from a map of source-key -> raw JSON arrays.
   * Source keys are resolved through TYPE_MAP (e.g. "monsters" -> "monster").
   * If a key is not in TYPE_MAP it is used as-is.
   */
  loadFromData(sources: SrdDataSources): void {
    this.bySlug.clear();
    this.byType.clear();

    for (const [sourceKey, items] of Object.entries(sources)) {
      const entityType = TYPE_MAP[sourceKey] ?? sourceKey;
      const bucket: SrdEntity[] = [];

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
   * Load all bundled SRD JSON files.
   */
  loadFromBundledJson(): void {
    const sources: SrdDataSources = {
      monsters: monstersJson,
      spells: spellsJson,
      magicitems: magicitemsJson,
      armor: armorJson,
      weapons: weaponsJson,
      feats: featsJson,
      conditions: conditionsJson,
      classes: classesJson,
      backgrounds: backgroundsJson,
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
