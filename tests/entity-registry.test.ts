import { describe, it, expect, beforeEach } from "vitest";
import { EntityRegistry } from "../src/shared/entities/entity-registry";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

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
    filePath: "Compendium/SRD/Monsters/Goblin.md",
    data: { size: "Small", type: "Humanoid", cr: "1/4" },
    compendium: "SRD",
    readonly: true,
    homebrew: false,
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
      expect(result!.compendium).toBe("SRD");
      expect(result!.readonly).toBe(true);
      expect(result!.homebrew).toBe(false);
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
          compendium: "Homebrew",
          readonly: false,
          homebrew: true,
          filePath: "Compendium/Custom/Monsters/Goblin Chief.md",
        }),
      );

      const result = registry.getBySlug("goblin");
      expect(result).toBeDefined();
      expect(result!.name).toBe("Goblin Chief");
      expect(result!.compendium).toBe("Homebrew");
      expect(result!.readonly).toBe(false);
      expect(result!.homebrew).toBe(true);
      expect(registry.count()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getByTypeAndSlug()
  // -------------------------------------------------------------------------
  describe("getByTypeAndSlug", () => {
    it("returns the entity when type and slug both match", () => {
      registry.register(makeEntity({ slug: "goblin", entityType: "monster" }));

      const result = registry.getByTypeAndSlug("monster", "goblin");
      expect(result).toBeDefined();
      expect(result!.name).toBe("Goblin");
      expect(result!.entityType).toBe("monster");
    });

    it("returns undefined when the slug exists under a different type", () => {
      // Regression: D&D 5e SRD has `acolyte` as both monster and background.
      registry.register(
        makeEntity({ slug: "acolyte", name: "Acolyte", entityType: "background" }),
      );

      expect(registry.getByTypeAndSlug("monster", "acolyte")).toBeUndefined();
    });

    it("returns undefined when the slug does not exist at all", () => {
      expect(registry.getByTypeAndSlug("monster", "nonexistent")).toBeUndefined();
    });

    it("retrieves each entity by its type after registering different slugs under different types", () => {
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "background",
          filePath: "Compendium/SRD/Backgrounds/Acolyte.md",
        }),
      );
      registry.register(
        makeEntity({
          slug: "goblin",
          name: "Goblin",
          entityType: "monster",
          filePath: "Compendium/SRD/Monsters/Goblin.md",
        }),
      );

      expect(registry.getByTypeAndSlug("background", "acolyte")!.name).toBe("Acolyte");
      expect(registry.getByTypeAndSlug("monster", "goblin")!.name).toBe("Goblin");
      // Cross-type lookups return undefined.
      expect(registry.getByTypeAndSlug("monster", "acolyte")).toBeUndefined();
      expect(registry.getByTypeAndSlug("background", "goblin")).toBeUndefined();
    });

    it("after registering monster:acolyte then background:acolyte, both are retrievable via getByTypeAndSlug", () => {
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "monster",
          filePath: "Compendium/SRD/Monsters/Acolyte.md",
        }),
      );
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "background",
          filePath: "Compendium/SRD/Backgrounds/Acolyte.md",
        }),
      );

      const monsterAcolyte = registry.getByTypeAndSlug("monster", "acolyte");
      const backgroundAcolyte = registry.getByTypeAndSlug("background", "acolyte");

      expect(monsterAcolyte).toBeDefined();
      expect(monsterAcolyte!.entityType).toBe("monster");
      expect(monsterAcolyte!.filePath).toBe("Compendium/SRD/Monsters/Acolyte.md");

      expect(backgroundAcolyte).toBeDefined();
      expect(backgroundAcolyte!.entityType).toBe("background");
      expect(backgroundAcolyte!.filePath).toBe("Compendium/SRD/Backgrounds/Acolyte.md");
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
  // unregister()
  // -------------------------------------------------------------------------
  describe("unregister", () => {
    it("removes entity by slug", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin" }));
      registry.register(makeEntity({ slug: "orc", name: "Orc" }));

      registry.unregister("goblin");

      expect(registry.getBySlug("goblin")).toBeUndefined();
      expect(registry.getBySlug("orc")).toBeDefined();
      expect(registry.count()).toBe(1);
    });

    it("removes entity from type bucket", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }));
      registry.register(
        makeEntity({ slug: "fireball", name: "Fireball", entityType: "spell" }),
      );

      registry.unregister("goblin");

      expect(registry.getTypes()).toEqual(["spell"]);
    });

    it("is a no-op for unknown slug", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin" }));

      registry.unregister("nonexistent");

      expect(registry.count()).toBe(1);
    });

    it("cleans up empty type bucket", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }));

      registry.unregister("goblin");

      expect(registry.getTypes()).toEqual([]);
      expect(registry.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // unregisterByTypeAndSlug()
  // -------------------------------------------------------------------------
  describe("unregisterByTypeAndSlug", () => {
    it("removes only the specified (type, slug) entry, leaving same-slug-different-type entries intact", () => {
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "monster",
          filePath: "Compendium/SRD/Monsters/Acolyte.md",
        }),
      );
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "background",
          filePath: "Compendium/SRD/Backgrounds/Acolyte.md",
        }),
      );

      registry.unregisterByTypeAndSlug("background", "acolyte");

      expect(registry.getByTypeAndSlug("background", "acolyte")).toBeUndefined();
      const monsterAcolyte = registry.getByTypeAndSlug("monster", "acolyte");
      expect(monsterAcolyte).toBeDefined();
      expect(monsterAcolyte!.entityType).toBe("monster");
    });

    it("removes from bySlug when flat entry matches the specified type", () => {
      registry.register(
        makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }),
      );

      registry.unregisterByTypeAndSlug("monster", "goblin");

      expect(registry.getBySlug("goblin")).toBeUndefined();
      expect(registry.getByTypeAndSlug("monster", "goblin")).toBeUndefined();
      expect(registry.count()).toBe(0);
    });

    it("leaves bySlug entry when flat entry belongs to a different type", () => {
      // monster registered first, then background overwrites bySlug.
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "monster",
          filePath: "Compendium/SRD/Monsters/Acolyte.md",
        }),
      );
      registry.register(
        makeEntity({
          slug: "acolyte",
          name: "Acolyte",
          entityType: "background",
          filePath: "Compendium/SRD/Backgrounds/Acolyte.md",
        }),
      );

      // bySlug holds the background (registered last); removing the monster
      // must not touch bySlug.
      registry.unregisterByTypeAndSlug("monster", "acolyte");

      const flat = registry.getBySlug("acolyte");
      expect(flat).toBeDefined();
      expect(flat!.entityType).toBe("background");
    });

    it("is a no-op for unknown (type, slug) pair", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }));

      registry.unregisterByTypeAndSlug("spell", "goblin");
      registry.unregisterByTypeAndSlug("monster", "nonexistent");

      expect(registry.count()).toBe(1);
      expect(registry.getBySlug("goblin")).toBeDefined();
    });

    it("cleans up empty type bucket", () => {
      registry.register(makeEntity({ slug: "goblin", name: "Goblin", entityType: "monster" }));

      registry.unregisterByTypeAndSlug("monster", "goblin");

      expect(registry.getTypes()).toEqual([]);
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
