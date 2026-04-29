import { describe, it, expect } from "vitest";
import { projectToRuntime } from "../../tools/srd-canonical/to-runtime";

describe("projectToRuntime", () => {
  it("drops prose description field for items", () => {
    const item = { slug: "shield-+1", name: "Shield +1", bonuses: { ac: 1 }, description: "A magical shield…", entries: ["…"], rarity: "uncommon" };
    const out = projectToRuntime("magicitem", item);
    expect(out.description).toBeUndefined();
    expect(out.entries).toBeUndefined();
    expect(out.bonuses).toEqual({ ac: 1 });
    expect(out.slug).toBe("shield-+1");
    expect(out.rarity).toBe("uncommon");
  });

  it("keeps mechanical fields for spells (range, duration, components)", () => {
    const spell = { slug: "fireball", name: "Fireball", description: "Long prose…", range: "150 ft", components: { v: true, s: true, m: "ball of bat guano" }, level: 3 };
    const out = projectToRuntime("spell", spell);
    expect(out.description).toBeUndefined();
    expect(out.range).toBe("150 ft");
    expect(out.level).toBe(3);
    expect(out.components).toBeDefined();
  });

  it("throws on unknown kind", () => {
    expect(() => projectToRuntime("aether", {})).toThrow(/unknown kind/);
  });
});
