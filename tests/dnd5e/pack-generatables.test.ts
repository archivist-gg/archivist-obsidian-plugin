import { describe, it, expect } from "vitest";
import { dnd5ePack, monsterGeneratable } from "@archivist/dnd5e";

describe("dnd5e pack generatables", () => {
  it("exposes exactly the 5 generate-capable types in pack order", () => {
    expect(dnd5ePack.entityTypes.filter((et) => et.generatable).map((et) => et.type))
      .toEqual(["monster", "spell", "item", "npc", "encounter"]);
  });

  it("spell + item enrich produce data", () => {
    const spell = dnd5ePack.entityTypes.find((et) => et.type === "spell")?.generatable;
    const item = dnd5ePack.entityTypes.find((et) => et.type === "item")?.generatable;
    expect(spell).toBeDefined();
    expect(item).toBeDefined();
    expect(spell!.enrich({ name: "Light", level: 0 })).toBeDefined();
    expect(item!.enrich({ name: "Cloak", type: "wondrous", rarity: "rare" })).toBeDefined();
  });

  it("npc + encounter identity-enrich their input", () => {
    const npc = dnd5ePack.entityTypes.find((et) => et.type === "npc")?.generatable;
    const enc = dnd5ePack.entityTypes.find((et) => et.type === "encounter")?.generatable;
    expect(npc).toBeDefined();
    expect(enc).toBeDefined();
    expect(npc!.enrich({ role: "guard" })).toEqual({ role: "guard" });
    const encInput = { party_size: 4, party_level: 5, difficulty: "medium" };
    expect(enc!.enrich(encInput)).toEqual(encInput);
  });

  it("monster generatable documents the inline-formula-tag grammar", () => {
    const instructions = monsterGeneratable.instructions ?? "";
    expect(instructions).toContain("atk:");
    expect(instructions).toContain("dmg:");
    expect(instructions).toContain("dc:");
    expect(instructions).toContain("STR+PB");
    expect(instructions).toContain("Worked examples:");
    expect(instructions).toContain("Melee Weapon Attack:");
    expect(instructions).toMatch(/CR-derived fields .*filled automatically/);
    expect(monsterGeneratable.description).toContain("Generate a D&D 5e monster stat block.");
  });
});
