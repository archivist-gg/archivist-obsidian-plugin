// tests/item-conditions-evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "../src/modules/item/item.conditions";
import type { ConditionContext } from "../src/modules/item/item.conditions.types";

function ctx(over: Partial<ConditionContext> = {}): ConditionContext {
  return {
    derived: { equippedSlots: {} },
    classList: [],
    race: null,
    subclasses: [],
    ...over,
  };
}

describe("evaluateCondition - Tier 1", () => {
  it("no_armor -> true when armor slot empty", () => {
    expect(evaluateCondition({ kind: "no_armor" }, ctx())).toBe("true");
  });

  it("no_armor -> false when armor slot filled", () => {
    const c = ctx({
      derived: { equippedSlots: { armor: { index: 0, entity: null, entityType: "armor", entry: { item: "x" } } } },
    });
    expect(evaluateCondition({ kind: "no_armor" }, c)).toBe("false");
  });

  it("no_shield -> true when shield slot empty", () => {
    expect(evaluateCondition({ kind: "no_shield" }, ctx())).toBe("true");
  });

  it("no_shield -> false when shield slot filled", () => {
    const c = ctx({
      derived: { equippedSlots: { shield: { index: 0, entity: null, entityType: "armor", entry: { item: "s" } } } },
    });
    expect(evaluateCondition({ kind: "no_shield" }, c)).toBe("false");
  });

  it("wielding_two_handed -> false when no two-handed mainhand", () => {
    expect(evaluateCondition({ kind: "wielding_two_handed" }, ctx())).toBe("false");
  });

  it("is_class -> true on exact slug match", () => {
    const c = ctx({ classList: [{ name: "[[bard]]", level: 5, subclass: null, choices: {} }] });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("true");
  });

  it("is_class -> true on multiclass inclusion", () => {
    const c = ctx({
      classList: [
        { name: "[[fighter]]", level: 3, subclass: null, choices: {} },
        { name: "[[bard]]", level: 2, subclass: null, choices: {} },
      ],
    });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("true");
  });

  it("is_class -> false on no match", () => {
    const c = ctx({ classList: [{ name: "[[fighter]]", level: 5, subclass: null, choices: {} }] });
    expect(evaluateCondition({ kind: "is_class", value: "bard" }, c)).toBe("false");
  });

  it("is_race -> true on slug match", () => {
    const c = ctx({ race: "[[dwarf]]" });
    expect(evaluateCondition({ kind: "is_race", value: "dwarf" }, c)).toBe("true");
  });

  it("is_race -> false when race null", () => {
    expect(evaluateCondition({ kind: "is_race", value: "dwarf" }, ctx())).toBe("false");
  });

  it("is_subclass -> true on slug membership", () => {
    const c = ctx({ subclasses: ["soulknife", "evocation"] });
    expect(evaluateCondition({ kind: "is_subclass", value: "soulknife" }, c)).toBe("true");
  });

  it("is_subclass -> false when not present", () => {
    expect(evaluateCondition({ kind: "is_subclass", value: "soulknife" }, ctx())).toBe("false");
  });
});

describe("evaluateCondition - Tier 2-4 always informational in v1", () => {
  it.each([
    [{ kind: "vs_creature_type", value: "undead" }],
    [{ kind: "vs_attack_type", value: "ranged" }],
    [{ kind: "on_attack_type", value: "ranged" }],
    [{ kind: "with_weapon_property", value: "longbow" }],
    [{ kind: "vs_spell_save" }],
    [{ kind: "lighting", value: "dim" }],
    [{ kind: "underwater" }],
    [{ kind: "movement_state", value: "flying" }],
    [{ kind: "has_condition", value: "grappled" }],
    [{ kind: "is_concentrating" }],
    [{ kind: "bloodied" }],
  ] as const)("%j -> informational", (cond) => {
    expect(evaluateCondition(cond, ctx())).toBe("informational");
  });
});

describe("evaluateCondition - raw and any_of", () => {
  it("raw -> always informational", () => {
    expect(evaluateCondition({ kind: "raw", text: "anything" }, ctx())).toBe("informational");
  });

  it("any_of -> true when any branch true", () => {
    const c = ctx({ classList: [{ name: "[[bard]]", level: 1, subclass: null, choices: {} }] });
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "fighter" },
        { kind: "is_class" as const, value: "bard" },
      ],
    };
    expect(evaluateCondition(cond, c)).toBe("true");
  });

  it("any_of -> false when all branches false", () => {
    const c = ctx({ classList: [{ name: "[[wizard]]", level: 1, subclass: null, choices: {} }] });
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "fighter" },
        { kind: "is_class" as const, value: "bard" },
      ],
    };
    expect(evaluateCondition(cond, c)).toBe("false");
  });

  it("any_of -> informational when any branch informational and none true", () => {
    const cond = {
      kind: "any_of" as const,
      conditions: [
        { kind: "is_class" as const, value: "bard" }, // false
        { kind: "underwater" as const },                // informational
      ],
    };
    expect(evaluateCondition(cond, ctx())).toBe("informational");
  });
});
