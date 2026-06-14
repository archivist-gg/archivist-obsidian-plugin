import { describe, it, expect } from "vitest";
import { subclassEntitySchema } from "../src/modules/subclass/subclass.schema";

describe("subclass schema — spellcasting", () => {
  it("accepts a third-caster subclass with a known/cantrip table", () => {
    const parsed = subclassEntitySchema.safeParse({
      slug: "architect-of-ruin",
      name: "Architect of Ruin",
      parent_class: "[[reaver]]",
      edition: "2014",
      source: "Reaver Revised",
      description: "x",
      features_by_level: {},
      resources: [],
      spellcasting: {
        caster_type: "third",
        ability: "cha",
        preparation: "known",
        spell_list: "architect-of-ruin",
      },
      table: { "3": { columns: { "Cantrips Known": 2, "Spells Known": 3 } } },
    });
    expect(parsed.success).toBe(true);
  });
});
