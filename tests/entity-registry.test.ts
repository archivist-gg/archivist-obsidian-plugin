import { describe, it, expect, beforeEach } from "vitest";
import { EntityRegistry } from "../src/entities/entity-registry";
import type { RegisteredEntity } from "../src/entities/entity-registry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(
  overrides: Partial<RegisteredEntity> = {},
): RegisteredEntity {
  return {
    slug: "goblin",
    name: "Goblin",
    entityType: "monster",
    source: "srd",
    filePath: "Compendium/SRD/Monsters/Goblin.md",
    data: { size: "Small", type: "Humanoid", cr: "1/4" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EntityRegistry", () => {
  let registry: EntityRegistry;

  beforeEach(() => {
    registry = new EntityRegistry();
  });

  // -------------------------------------------------------------------------
  // register() and getBySlug()
  // -------------------------------------------------------------------------
  describe("register and getBySlug", () => {
    it("registers an entity and retrieves it by slug", () => {
      const entity = makeEntity();
      registry.register(entity);

      const result = registry.getBySlug("goblin");
      expect(result).toBeDefined();
      expect(result!.name).toBe("Goblin");
      expect(result!.entityType).toBe("monster");
      expect(result!.source).toBe("srd");
      expect(result!.filePath).toBe("Compendium/SRD/Monsters/Goblin.md");
    });

    it("returns undefined for unknown slug", () => {
      expect(registry.getBySlug("nonexistent")).toBeUndefined();
    });

    it("duplicate slug replaces existing entry", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin" }));
      registry.register(
        makeEntity({
          slug: "goblin",
          name: "Goblin Chief",
          source: "custom",
          filePath: "Compendium/Custom/Monsters/Goblin Chief.md",
        }),
      );

      const result = registry.getBySlug("goblin");
      expect(result).toBeDefined();
      expect(result!.name).toBe("Goblin Chief");
      expect(result!.source).toBe("custom");
      expect(registry.count()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // search() -- ranked results
  // -------------------------------------------------------------------------
  describe("search ranked results", () => {
    beforeEach(() => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin" }));
      registry.register(
        makeEntity({ slug: "goblin-boss", name: "Goblin Boss" }),
      );
      registry.register(
        makeEntity({ slug: "hobgoblin", name: "Hobgoblin" }),
      );
    });

    it("exact match ranks first", () => {
      const results = registry.search("goblin");
      expect(results[0].name).toBe("Goblin");
    });

    it("starts-with ranks above contains", () => {
      const results = registry.search("goblin");
      const names = results.map((r) => r.name);
      // "Goblin" (exact) first, "Goblin Boss" (starts-with) second, "Hobgoblin" (contains) last
      expect(names).toEqual(["Goblin", "Goblin Boss", "Hobgoblin"]);
    });

    it("search is case-insensitive", () => {
      const results = registry.search("GOBLIN");
      expect(results.length).toBe(3);
      expect(results[0].name).toBe("Goblin");
    });
  });

  // -------------------------------------------------------------------------
  // search() -- filters by entityType
  // -------------------------------------------------------------------------
  describe("search filters by entityType", () => {
    beforeEach(() => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }));
      registry.register(
        makeEntity({
          slug: "fireball",
          name: "Fireball",
          entityType: "spell",
          filePath: "Compendium/SRD/Spells/Fireball.md",
        }),
      );
      registry.register(
        makeEntity({
          slug: "fire-bolt",
          name: "Fire Bolt",
          entityType: "spell",
          filePath: "Compendium/SRD/Spells/Fire Bolt.md",
        }),
      );
    });

    it("returns only entities of the specified type", () => {
      const results = registry.search("fire", "spell");
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r.entityType).toBe("spell"));
    });

    it("returns empty for type with no matches", () => {
      const results = registry.search("fire", "monster");
      expect(results).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // search() -- respects limit
  // -------------------------------------------------------------------------
  describe("search respects limit", () => {
    beforeEach(() => {
      // Register 25 entities
      for (let i = 0; i < 25; i++) {
        registry.register(
          makeEntity({
            slug: `monster-${i}`,
            name: `Monster ${i}`,
            filePath: `Compendium/SRD/Monsters/Monster ${i}.md`,
          }),
        );
      }
    });

    it("defaults to limit 20", () => {
      const results = registry.search("monster");
      expect(results).toHaveLength(20);
    });

    it("respects custom limit", () => {
      const results = registry.search("monster", undefined, 5);
      expect(results).toHaveLength(5);
    });
  });

  // -------------------------------------------------------------------------
  // getTypes()
  // -------------------------------------------------------------------------
  describe("getTypes", () => {
    it("returns all registered entity types", () => {
      registry.register(makeEntity({ slug: "goblin", entityType: "monster" }));
      registry.register(
        makeEntity({ slug: "fireball", name: "Fireball", entityType: "spell" }),
      );
      registry.register(
        makeEntity({
          slug: "breastplate",
          name: "Breastplate",
          entityType: "armor",
        }),
      );

      const types = registry.getTypes().sort();
      expect(types).toEqual(["armor", "monster", "spell"]);
    });

    it("returns empty array when no entities registered", () => {
      expect(registry.getTypes()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getAllSlugs()
  // -------------------------------------------------------------------------
  describe("getAllSlugs", () => {
    it("returns all registered slugs as a Set", () => {
      registry.register(makeEntity({ slug: "goblin" }));
      registry.register(
        makeEntity({ slug: "fireball", name: "Fireball", entityType: "spell" }),
      );

      const slugs = registry.getAllSlugs();
      expect(slugs).toBeInstanceOf(Set);
      expect(slugs.size).toBe(2);
      expect(slugs.has("goblin")).toBe(true);
      expect(slugs.has("fireball")).toBe(true);
    });

    it("returns empty Set when no entities registered", () => {
      expect(registry.getAllSlugs().size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // count()
  // -------------------------------------------------------------------------
  describe("count", () => {
    it("returns total number of registered entities", () => {
      registry.register(makeEntity({ slug: "goblin" }));
      registry.register(
        makeEntity({ slug: "fireball", name: "Fireball", entityType: "spell" }),
      );
      expect(registry.count()).toBe(2);
    });

    it("returns 0 when empty", () => {
      expect(registry.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // clear()
  // -------------------------------------------------------------------------
  describe("clear", () => {
    it("empties everything", () => {
      registry.register(makeEntity({ slug: "goblin" }));
      registry.register(
        makeEntity({ slug: "fireball", name: "Fireball", entityType: "spell" }),
      );
      expect(registry.count()).toBe(2);

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.getBySlug("goblin")).toBeUndefined();
      expect(registry.getTypes()).toEqual([]);
      expect(registry.getAllSlugs().size).toBe(0);
    });
  });
});
