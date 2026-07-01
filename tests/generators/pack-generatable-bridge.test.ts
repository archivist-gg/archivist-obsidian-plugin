import { describe, it, expect } from "vitest";
import { dnd5ePack } from "@archivist/dnd5e";
import { generatableToSdkTool } from "@archivist/generators";

describe("B7 pack→SDK generation bridge", () => {
  const generatables = dnd5ePack.entityTypes
    .map((et) => et.generatable)
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  it("every pack generatable maps to a distinct generate_<type> SDK tool", () => {
    const names = generatables.map((g) => generatableToSdkTool(g).name);
    expect(names).toEqual([...new Set(names)]); // no duplicate registration
    for (const g of generatables) {
      expect(generatableToSdkTool(g).name).toBe(g.toolName ?? `generate_${g.type}`);
    }
  });

  it("includes monster (present since Plan A)", () => {
    expect(generatables.map((g) => g.type)).toContain("monster");
  });

  it("spell maps to generate_spell with a {type,data} envelope", async () => {
    const g = dnd5ePack.entityTypes.find((et) => et.type === "spell")?.generatable;
    expect(g).toBeDefined();
    const sdk = generatableToSdkTool(g!);
    expect(sdk.name).toBe("generate_spell");
    const res = await sdk.handler({ spell: { name: "Light", level: 0 } }, {});
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.type).toBe("spell");
    expect(parsed.data).toBeDefined();
  });

  it("item maps to generate_item with a {type,data} envelope", async () => {
    const g = dnd5ePack.entityTypes.find((et) => et.type === "item")?.generatable;
    expect(g).toBeDefined();
    const sdk = generatableToSdkTool(g!);
    expect(sdk.name).toBe("generate_item");
    const res = await sdk.handler({ item: { name: "Cloak", type: "wondrous", rarity: "rare" } }, {});
    const parsed = JSON.parse(res.content[0].text);
    expect(parsed.type).toBe("item");
    expect(parsed.data).toBeDefined();
  });

  it("npc + encounter map to identity-enrich generate tools", async () => {
    for (const t of ["npc", "encounter"] as const) {
      const g = dnd5ePack.entityTypes.find((et) => et.type === t)?.generatable;
      expect(g).toBeDefined();
      const sdk = generatableToSdkTool(g!);
      expect(sdk.name).toBe(`generate_${t}`);
      const input = t === "npc" ? { role: "guard" } : { party_size: 4, party_level: 5, difficulty: "medium" };
      const res = await sdk.handler({ [t]: input }, {});
      const parsed = JSON.parse(res.content[0].text);
      expect(parsed.type).toBe(t);
      expect(parsed.data).toEqual(input); // identity enrich
    }
  });

  it("pack exposes exactly the 5 generate-capable types in pack order", () => {
    expect(dnd5ePack.entityTypes.filter((et) => et.generatable).map((et) => et.type))
      .toEqual(["monster", "spell", "item", "npc", "encounter"]);
  });
});
