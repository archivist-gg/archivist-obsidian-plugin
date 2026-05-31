import { describe, it, expect } from "vitest";
import { spellScales, spellEffectAtSlot, upcastLevelsFor } from "../src/modules/pc/components/spells/spell-scaling";
import type { Spell } from "../src/modules/spell/spell.types";

const mm2024: Spell = {
  name: "Magic Missile", level: 1,
  at_higher_levels: ["+1 dart per slot above 1st"],
  casting_options: [
    { type: "slot_level_2", target_count: 4 },
    { type: "slot_level_3", target_count: 5 },
  ],
} as Spell;

const mm2014: Spell = {
  name: "Magic Missile", level: 1,
  at_higher_levels: ["+1 dart per slot above 1st"],
  casting_options: [
    { type: "slot_level_2", target_count: 2 }, // BAD 2014 encoding: count == slot level
    { type: "slot_level_3", target_count: 3 },
  ],
} as Spell;

const fireball: Spell = {
  name: "Fireball", level: 3,
  casting_options: [{ type: "slot_level_4", damage_roll: "9d6" }],
} as Spell;

const shield: Spell = { name: "Shield", level: 1 } as Spell;

describe("spellScales", () => {
  it("is true when casting_options or at_higher_levels exist, false otherwise", () => {
    expect(spellScales(mm2024)).toBe(true);
    expect(spellScales(fireball)).toBe(true);
    expect(spellScales(shield)).toBe(false);
  });
});

describe("spellEffectAtSlot", () => {
  it("returns the damage_roll for that slot level", () => {
    expect(spellEffectAtSlot(fireball, 4)).toBe("9d6");
  });
  it("returns a target_count label for trustworthy data (2024)", () => {
    expect(spellEffectAtSlot(mm2024, 2)).toBe("4 targets");
  });
  it("suppresses the known-bad 2014 target_count (count === slot level)", () => {
    expect(spellEffectAtSlot(mm2014, 2)).toBeNull();
    expect(spellEffectAtSlot(mm2014, 3)).toBeNull();
  });
  it("returns null when there is no option for that level", () => {
    expect(spellEffectAtSlot(fireball, 9)).toBeNull();
    expect(spellEffectAtSlot(shield, 2)).toBeNull();
  });
});

describe("upcastLevelsFor", () => {
  it("lists owned slot levels strictly above base only when the spell scales", () => {
    expect(upcastLevelsFor(mm2024, [1, 2, 3])).toEqual([2, 3]);
    expect(upcastLevelsFor(shield, [1, 2, 3])).toEqual([]); // non-scaling: no repeats
    expect(upcastLevelsFor(fireball, [3])).toEqual([]);     // no higher owned slot
  });
});
