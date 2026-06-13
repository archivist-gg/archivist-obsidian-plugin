import { describe, it, expect } from "vitest";
import { startingEquipmentEntrySchema, startingGoldSchema } from "../src/shared/schemas/equipment-grant-schema";
import { classEntitySchema } from "../src/modules/class/class.schema";

describe("equipment-grant schema", () => {
  it("accepts a choice entry with itemized + category + gold grants", () => {
    const parsed = startingEquipmentEntrySchema.parse({
      kind: "choice",
      options: [
        { label: "Chain Mail, a martial weapon, 4 GP", grants: [
          { item: "chain-mail" },
          { item: "javelin", qty: 8 },
          { category: "martial-weapon" },
          { gold: 4 },
        ] },
        { label: "Gold only", grants: [{ gold: 155 }] },
      ],
    });
    expect(parsed.kind).toBe("choice");
  });

  it("accepts a fixed entry with an optional display label", () => {
    expect(startingEquipmentEntrySchema.parse({ kind: "fixed", label: "Robe", grants: [{ item: "robe" }] }).kind).toBe("fixed");
  });

  it("accepts a gold entry and a starting_gold dice spec", () => {
    expect(startingEquipmentEntrySchema.parse({ kind: "gold", amount: 50 }).kind).toBe("gold");
    expect(startingGoldSchema.parse({ dice: "5d4", multiplier: 10 }).multiplier).toBe(10);
    expect(startingGoldSchema.parse({ fixed: 155 }).fixed).toBe(155);
  });

  it("rejects an unknown grant key", () => {
    expect(() => startingEquipmentEntrySchema.parse({ kind: "fixed", grants: [{ nonsense: 1 }] })).toThrow();
  });
});

describe("class schema with structured equipment", () => {
  const base = {
    slug: "x", name: "X", edition: "2024", source: "SRD", description: "",
    hit_die: "d10", primary_abilities: ["str"], saving_throws: ["str", "con"],
    proficiencies: { armor: [], weapons: { categories: ["martial"] } },
    skill_choices: { count: 2, from: ["athletics", "history"] },
    spellcasting: null, subclass_level: 3, subclass_feature_name: "Subclass",
    weapon_mastery: null, epic_boon_level: null, table: {}, features_by_level: {}, resources: [],
  };
  it("parses structured starting_equipment + starting_gold", () => {
    const parsed = classEntitySchema.parse({
      ...base,
      starting_equipment: [{ kind: "choice", options: [{ label: "Chain Mail", grants: [{ item: "chain-mail" }, { gold: 4 }] }] }],
      starting_gold: { fixed: 155 },
    });
    expect(parsed.starting_equipment[0].kind).toBe("choice");
    expect(parsed.starting_gold?.fixed).toBe(155);
  });
});
