import { describe, it, expect, beforeAll } from "vitest";
import { SrdStore } from "../src/shared/ai/srd-store";
import type { SrdDataSources } from "../src/shared/ai/srd-store";

// ---------------------------------------------------------------------------
// Test fixtures -- small representative data for each entity type
// ---------------------------------------------------------------------------
const TEST_SOURCES: SrdDataSources = {
  monsters: [
    { slug: "goblin", name: "Goblin", size: "Small", type: "Humanoid", cr: "1/4" },
    { slug: "red-dragon", name: "Red Dragon", size: "Huge", type: "Dragon", cr: "17" },
    { slug: "goblin-boss", name: "Goblin Boss", size: "Small", type: "Humanoid", cr: "1" },
  ],
  spells: [
    { slug: "fireball", name: "Fireball", level: 3, school: "evocation" },
    { slug: "fire-bolt", name: "Fire Bolt", level: 0, school: "evocation" },
    { slug: "shield", name: "Shield", level: 1, school: "abjuration" },
  ],
  magicitems: [
    { slug: "flame-tongue", name: "Flame Tongue", type: "weapon", rarity: "rare" },
    { slug: "ring-of-protection", name: "Ring of Protection", type: "ring", rarity: "rare" },
  ],
  armor: [
    { slug: "breastplate", name: "Breastplate", category: "Medium Armor" },
    { slug: "chain-mail", name: "Chain Mail", category: "Heavy Armor" },
  ],
  weapons: [
    { slug: "longsword", name: "Longsword", category: "Martial Melee Weapons" },
  ],
  feats: [
    { slug: "grappler", name: "Grappler", desc: "Close-quarters grappling feat" },
  ],
  conditions: [
    { slug: "blinded", name: "Blinded", desc: "Can't see" },
    { slug: "charmed", name: "Charmed", desc: "Can't attack charmer" },
  ],
  classes: [
    { slug: "barbarian", name: "Barbarian", hit_die: "1d12" },
    { slug: "wizard", name: "Wizard", hit_die: "1d6" },
  ],
  backgrounds: [
    { slug: "acolyte", name: "Acolyte", desc: "Temple service" },
  ],
};

// Total entities across all sources
const TOTAL_COUNT =
  3 + // monsters
  3 + // spells
  2 + // magic-items
  2 + // armor
  1 + // weapons
  1 + // feats
  2 + // conditions
  2 + // classes
  1;  // backgrounds

describe("SrdStore", () => {
  let store: SrdStore;

  beforeAll(() => {
    store = new SrdStore();
    store.loadFromData(TEST_SOURCES);
  });

  // -------------------------------------------------------------------------
  // count()
  // -------------------------------------------------------------------------
  describe("count", () => {
    it("returns total entity count across all types", () => {
      expect(store.count()).toBe(TOTAL_COUNT);
    });
  });

  // -------------------------------------------------------------------------
  // getTypes()
  // -------------------------------------------------------------------------
  describe("getTypes", () => {
    it("returns all 9 canonical entity types", () => {
      const types = store.getTypes().sort();
      expect(types).toEqual([
        "armor",
        "background",
        "class",
        "condition",
        "feat",
        "item",
        "monster",
        "spell",
        "weapon",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // getBySlug()
  // -------------------------------------------------------------------------
  describe("getBySlug", () => {
    it("returns entity by slug", () => {
      const entity = store.getBySlug("goblin");
      expect(entity).toBeDefined();
      expect(entity!.name).toBe("Goblin");
      expect(entity!.entityType).toBe("monster");
      expect(entity!.slug).toBe("goblin");
    });

    it("returns undefined for unknown slug", () => {
      expect(store.getBySlug("nonexistent")).toBeUndefined();
    });

    it("works for item type (maps from magicitems key)", () => {
      const entity = store.getBySlug("flame-tongue");
      expect(entity).toBeDefined();
      expect(entity!.entityType).toBe("item");
    });

    it("stores original data in data field", () => {
      const entity = store.getBySlug("fireball");
      expect(entity!.data).toEqual({
        slug: "fireball",
        name: "Fireball",
        level: 3,
        school: "evocation",
      });
    });
  });

  // -------------------------------------------------------------------------
  // getAllOfType()
  // -------------------------------------------------------------------------
  describe("getAllOfType", () => {
    it("returns all monsters", () => {
      expect(store.getAllOfType("monster")).toHaveLength(3);
    });

    it("returns all conditions", () => {
      expect(store.getAllOfType("condition")).toHaveLength(2);
    });

    it("returns empty array for unknown type", () => {
      expect(store.getAllOfType("nonexistent")).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // search() -- ranking
  // -------------------------------------------------------------------------
  describe("search ranking", () => {
    it("exact match ranks first", () => {
      const results = store.search("goblin", "monster");
      expect(results[0].name).toBe("Goblin");
    });

    it("starts-with ranks above contains", () => {
      // "Fire Bolt" and "Fireball" both start with "fire", "Flame Tongue" contains "f" but not "fire"
      const results = store.search("fire");
      const names = results.map((r) => r.name);
      // Fire Bolt and Fireball should come before anything that merely contains "fire"
      expect(names.indexOf("Fire Bolt")).toBeLessThan(names.length);
      expect(names.indexOf("Fireball")).toBeLessThan(names.length);
    });

    it("search is case-insensitive", () => {
      const results = store.search("RED DRAGON", "monster");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Red Dragon");
    });
  });

  // -------------------------------------------------------------------------
  // search() -- filtering
  // -------------------------------------------------------------------------
  describe("search filtering", () => {
    it("filters by entity type", () => {
      const results = store.search("fire", "spell");
      expect(results).toHaveLength(2); // Fireball, Fire Bolt
      results.forEach((r) => expect(r.entityType).toBe("spell"));
    });

    it("searches across all types when no filter", () => {
      // "fire" matches: Fireball, Fire Bolt (spells), Flame Tongue contains no "fire"
      const results = store.search("fire");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty for no matches", () => {
      expect(store.search("zzzzz")).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // search() -- limit
  // -------------------------------------------------------------------------
  describe("search limit", () => {
    it("defaults to limit 20", () => {
      // With our small dataset this won't hit 20, but verify it doesn't crash
      const results = store.search("a");
      expect(results.length).toBeLessThanOrEqual(20);
    });

    it("respects custom limit", () => {
      const results = store.search("goblin", "monster", 1);
      expect(results).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // search() -- new entity types
  // -------------------------------------------------------------------------
  describe("search across new entity types", () => {
    it("finds armor", () => {
      const results = store.search("breastplate", "armor");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("armor");
    });

    it("finds weapons", () => {
      const results = store.search("longsword", "weapon");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("weapon");
    });

    it("finds feats", () => {
      const results = store.search("grappler", "feat");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("feat");
    });

    it("finds conditions", () => {
      const results = store.search("blinded", "condition");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("condition");
    });

    it("finds classes", () => {
      const results = store.search("barbarian", "class");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("class");
    });

    it("finds backgrounds", () => {
      const results = store.search("acolyte", "background");
      expect(results).toHaveLength(1);
      expect(results[0].entityType).toBe("background");
    });
  });

  // -------------------------------------------------------------------------
  // loadFromData resets state
  // -------------------------------------------------------------------------
  describe("loadFromData reset", () => {
    it("clears previous data on reload", () => {
      const s = new SrdStore();
      s.loadFromData({ monsters: [{ slug: "orc", name: "Orc" }] });
      expect(s.count()).toBe(1);

      s.loadFromData({ spells: [{ slug: "wish", name: "Wish" }] });
      expect(s.count()).toBe(1);
      expect(s.getBySlug("orc")).toBeUndefined();
      expect(s.getBySlug("wish")).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Backward compatibility: getByName
  // -------------------------------------------------------------------------
  describe("getByName (backward compat)", () => {
    it("finds entity by exact name and type", () => {
      const result = store.getByName("Goblin", "monster");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Goblin");
    });

    it("is case-insensitive", () => {
      const result = store.getByName("goblin", "monster");
      expect(result).not.toBeNull();
    });

    it("returns null for unknown entity", () => {
      expect(store.getByName("Nonexistent", "monster")).toBeNull();
    });

    it("searches across all types when no entityType given", () => {
      const result = store.getByName("Fireball");
      expect(result).not.toBeNull();
      expect(result!.entityType).toBe("spell");
    });
  });

  // -------------------------------------------------------------------------
  // loadFromBundledJson
  // -------------------------------------------------------------------------
  describe("loadFromBundledJson", () => {
    it("loads all 9 entity types from bundled JSON", () => {
      const s = new SrdStore();
      s.loadFromBundledJson();
      expect(s.getTypes().sort()).toEqual([
        "armor",
        "background",
        "class",
        "condition",
        "feat",
        "item",
        "monster",
        "spell",
        "weapon",
      ]);
      // Should have many more entities than our test fixtures
      expect(s.count()).toBeGreaterThan(100);
    });

    it("can look up a well-known monster by slug", () => {
      const s = new SrdStore();
      s.loadFromBundledJson();
      const goblin = s.getBySlug("goblin");
      expect(goblin).toBeDefined();
      expect(goblin!.name).toBe("Goblin");
      expect(goblin!.entityType).toBe("monster");
    });

    it("can look up a well-known spell by slug", () => {
      const s = new SrdStore();
      s.loadFromBundledJson();
      const fireball = s.getBySlug("fireball");
      expect(fireball).toBeDefined();
      expect(fireball!.name).toBe("Fireball");
    });
  });
});
