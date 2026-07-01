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
});
