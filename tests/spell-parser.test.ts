import { describe, it, expect } from "vitest";
import { parseSpell } from "../src/modules/spell/spell.parser";

describe("parseSpell", () => {
  it("parses a minimal spell (name only)", () => {
    const result = parseSpell("name: Magic Missile");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Magic Missile");
    }
  });

  it("fails when name is missing", () => {
    const result = parseSpell("level: 3");
    expect(result.success).toBe(false);
  });

  it("parses a full spell", () => {
    const yaml = `
name: Fireball
level: 3
school: Evocation
casting_time: 1 action
range: 150 feet
components: V, S, M (a tiny ball of bat guano and sulfur)
duration: Instantaneous
concentration: false
ritual: false
classes: [Sorcerer, Wizard]
description:
  - "A bright streak flashes from your pointing finger."
at_higher_levels:
  - "Damage increases by 1d6 for each slot level above 3rd."
`;
    const result = parseSpell(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const s = result.data;
      expect(s.name).toBe("Fireball");
      expect(s.level).toBe(3);
      expect(s.school).toBe("Evocation");
      expect(s.concentration).toBe(false);
      expect(s.ritual).toBe(false);
      expect(s.classes).toEqual(["Sorcerer", "Wizard"]);
      expect(s.description?.length).toBe(1);
      expect(s.at_higher_levels?.length).toBe(1);
    }
  });

  it("parses a cantrip (level 0)", () => {
    const result = parseSpell("name: Fire Bolt\nlevel: 0\nschool: Evocation");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe(0);
    }
  });
});
