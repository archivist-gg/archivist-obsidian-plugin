import { describe, it, expect } from "vitest";
import { parseCompendiumRef, CompendiumRef } from "../src/shared/extensions/compendium-ref-parser";

describe("parseCompendiumRef", () => {
  it("should parse {{monster:goblin}}", () => {
    const ref = parseCompendiumRef("{{monster:goblin}}");
    expect(ref).toEqual({ entityType: "monster", slug: "goblin" });
  });

  it("should parse {{spell:fireball}}", () => {
    const ref = parseCompendiumRef("{{spell:fireball}}");
    expect(ref).toEqual({ entityType: "spell", slug: "fireball" });
  });

  it("should parse {{goblin}} without type prefix", () => {
    const ref = parseCompendiumRef("{{goblin}}");
    expect(ref).toEqual({ entityType: null, slug: "goblin" });
  });

  it("should parse {{item:flame-tongue}}", () => {
    const ref = parseCompendiumRef("{{item:flame-tongue}}");
    expect(ref).toEqual({ entityType: "item", slug: "flame-tongue" });
  });

  it("should return null for non-ref text", () => {
    expect(parseCompendiumRef("hello")).toBeNull();
    expect(parseCompendiumRef("{{}}")).toBeNull();
    expect(parseCompendiumRef("{monster:goblin}")).toBeNull();
  });

  it("should handle extra whitespace", () => {
    const ref = parseCompendiumRef("{{ monster:goblin }}");
    expect(ref).toEqual({ entityType: "monster", slug: "goblin" });
  });
});
