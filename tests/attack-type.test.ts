import { describe, it, expect } from "vitest";
import type { Attack } from "../src/shared/types/attack";

describe("Attack type extensions for Monster β+", () => {
  it("Attack accepts bonus (fixed to-hit modifier)", () => {
    const a: Attack = {
      name: "Bite",
      type: "melee",
      bonus: 17,
      damage: "2d10+10",
      damage_type: "piercing",
    };
    expect(a.bonus).toBe(17);
  });

  it("Attack accepts extra_damage object", () => {
    const a: Attack = {
      name: "Bite",
      type: "melee",
      bonus: 17,
      damage: "2d10+10",
      damage_type: "piercing",
      extra_damage: { dice: "4d6", type: "fire" },
    };
    expect(a.extra_damage?.dice).toBe("4d6");
    expect(a.extra_damage?.type).toBe("fire");
  });
});
