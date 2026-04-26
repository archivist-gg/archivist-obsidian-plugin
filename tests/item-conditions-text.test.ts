// tests/item-conditions-text.test.ts
import { describe, it, expect } from "vitest";
import {
  conditionToText,
  conditionsToText,
} from "../src/modules/item/item.conditions";

describe("conditionToText", () => {
  it.each([
    [{ kind: "no_armor" }, "no armor"],
    [{ kind: "no_shield" }, "no shield"],
    [{ kind: "wielding_two_handed" }, "wielding two-handed"],
    [{ kind: "is_class", value: "bard" }, "if Bard"],
    [{ kind: "is_race", value: "dwarf" }, "if Dwarf"],
    [{ kind: "is_subclass", value: "soulknife" }, "if Soulknife"],
    [{ kind: "vs_creature_type", value: "undead" }, "vs undead"],
    [{ kind: "vs_attack_type", value: "ranged" }, "vs ranged attacks"],
    [{ kind: "on_attack_type", value: "ranged" }, "on ranged attacks"],
    [{ kind: "with_weapon_property", value: "longbow" }, "with longbow"],
    [{ kind: "vs_spell_save" }, "vs spells"],
    [{ kind: "lighting", value: "dim" }, "in dim light"],
    [{ kind: "underwater" }, "underwater"],
    [{ kind: "movement_state", value: "flying" }, "while flying"],
    [{ kind: "has_condition", value: "grappled" }, "while grappled"],
    [{ kind: "is_concentrating" }, "while concentrating"],
    [{ kind: "bloodied" }, "while bloodied"],
    [{ kind: "raw", text: "while bloodied at half HP" }, "while bloodied at half HP"],
  ] as const)("%j -> %s", (cond, expected) => {
    expect(conditionToText(cond)).toBe(expected);
  });

  it("any_of -> parens with ' or '", () => {
    expect(
      conditionToText({
        kind: "any_of",
        conditions: [
          { kind: "with_weapon_property", value: "longbow" },
          { kind: "with_weapon_property", value: "shortbow" },
        ],
      }),
    ).toBe("(with longbow or with shortbow)");
  });

  it("nested any_of inside any_of renders nested parens", () => {
    expect(
      conditionToText({
        kind: "any_of",
        conditions: [
          { kind: "no_armor" },
          { kind: "any_of", conditions: [{ kind: "underwater" }, { kind: "bloodied" }] },
        ],
      }),
    ).toBe("(no armor or (underwater or while bloodied))");
  });
});

describe("conditionsToText", () => {
  it("empty list -> empty string", () => {
    expect(conditionsToText([])).toBe("");
  });

  it("single condition -> no joiner", () => {
    expect(conditionsToText([{ kind: "no_armor" }])).toBe("no armor");
  });

  it("AND-joins with ' and '", () => {
    expect(
      conditionsToText([{ kind: "no_armor" }, { kind: "no_shield" }]),
    ).toBe("no armor and no shield");
  });

  it("renders any_of inside AND-list", () => {
    expect(
      conditionsToText([
        { kind: "on_attack_type", value: "ranged" },
        {
          kind: "any_of",
          conditions: [
            { kind: "with_weapon_property", value: "longbow" },
            { kind: "with_weapon_property", value: "shortbow" },
          ],
        },
      ]),
    ).toBe("on ranged attacks and (with longbow or with shortbow)");
  });
});
