import { describe, it, expect } from "vitest";
import { parseEntityReference, resolveEntityReferences } from "../src/modules/inquiry/shared/components/EntityAutocompleteDropdown";

describe("parseEntityReference", () => {
  it("parses [[monster:Ancient Red Dragon]]", () => {
    expect(parseEntityReference("[[monster:Ancient Red Dragon]]")).toEqual({ type: "monster", name: "Ancient Red Dragon" });
  });
  it("parses [[Goblin]] without type prefix", () => {
    expect(parseEntityReference("[[Goblin]]")).toEqual({ type: null, name: "Goblin" });
  });
  it("returns null for non-entity text", () => {
    expect(parseEntityReference("hello")).toBeNull();
    expect(parseEntityReference("[[]]")).toBeNull();
  });
});

describe("resolveEntityReferences", () => {
  it("extracts all entity references from text", () => {
    const refs = resolveEntityReferences("Compare [[monster:Goblin]] with [[spell:Fireball]]");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ type: "monster", name: "Goblin" });
    expect(refs[1]).toEqual({ type: "spell", name: "Fireball" });
  });
  it("returns empty for text without references", () => {
    expect(resolveEntityReferences("no refs")).toEqual([]);
  });
});
