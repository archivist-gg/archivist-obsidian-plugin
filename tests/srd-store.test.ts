import { describe, it, expect, beforeAll } from "vitest";
import { SrdStore } from "../src/ai/srd/srd-store";

const TEST_MONSTERS = [
  { name: "Goblin", size: "Small", type: "Humanoid", cr: "1/4" },
  { name: "Red Dragon", size: "Huge", type: "Dragon", cr: "17" },
  { name: "Goblin Boss", size: "Small", type: "Humanoid", cr: "1" },
];

const TEST_SPELLS = [
  { name: "Fireball", level: 3, school: "evocation" },
  { name: "Fire Bolt", level: 0, school: "evocation" },
  { name: "Shield", level: 1, school: "abjuration" },
];

const TEST_ITEMS = [
  { name: "Flame Tongue", type: "weapon", rarity: "rare" },
  { name: "Ring of Protection", type: "ring", rarity: "rare" },
];

describe("SrdStore", () => {
  let store: SrdStore;

  beforeAll(() => {
    store = new SrdStore();
    store.loadFromArrays(TEST_MONSTERS as any[], TEST_SPELLS as any[], TEST_ITEMS as any[]);
  });

  it("searches monsters by name", () => {
    const results = store.search("goblin", "monster", 10);
    expect(results.length).toBe(2);
    expect(results[0].name).toBe("Goblin");
  });

  it("searches spells by name", () => {
    const results = store.search("fire", "spell", 10);
    expect(results.length).toBe(2);
  });

  it("searches items by name", () => {
    const results = store.search("flame", "item", 10);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Flame Tongue");
  });

  it("searches across all types when no type filter", () => {
    const results = store.search("fire", undefined, 10);
    expect(results.length).toBe(2); // Fireball, Fire Bolt
  });

  it("respects limit", () => {
    const results = store.search("goblin", "monster", 1);
    expect(results.length).toBe(1);
  });

  it("gets entity by exact name", () => {
    const result = store.getByName("Goblin", "monster");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Goblin");
  });

  it("returns null for unknown entity", () => {
    const result = store.getByName("Nonexistent", "monster");
    expect(result).toBeNull();
  });

  it("does case-insensitive search", () => {
    const results = store.search("RED DRAGON", "monster", 10);
    expect(results.length).toBe(1);
  });
});
