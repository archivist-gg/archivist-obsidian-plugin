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

describe("Spell parser reads casting_options[]", () => {
  it("parses YAML with casting_options array", () => {
    const yamlBody = `
name: Fireball
level: 3
casting_options:
  - type: slot_level_4
    damage_roll: 9d6
  - type: slot_level_5
    damage_roll: 10d6
`;
    const result = parseSpell(yamlBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.casting_options).toBeDefined();
      expect(result.data.casting_options!.length).toBe(2);
      expect(result.data.casting_options![0].type).toBe("slot_level_4");
      expect(result.data.casting_options![0].damage_roll).toBe("9d6");
      expect(result.data.casting_options![1].type).toBe("slot_level_5");
      expect(result.data.casting_options![1].damage_roll).toBe("10d6");
    }
  });

  it("parses casting_options with mixed numeric and string fields", () => {
    const yamlBody = `
name: Eldritch Blast
level: 0
casting_options:
  - type: player_level_5
    damage_roll: 2d10
    target_count: 2
  - type: shape_growth
    shape_size: 30
    duration: "1 minute"
    concentration: true
`;
    const result = parseSpell(yamlBody);
    expect(result.success).toBe(true);
    if (result.success) {
      const opts = result.data.casting_options!;
      expect(opts.length).toBe(2);
      expect(opts[0].target_count).toBe(2);
      expect(opts[0].damage_roll).toBe("2d10");
      expect(opts[1].shape_size).toBe(30);
      expect(opts[1].duration).toBe("1 minute");
      expect(opts[1].concentration).toBe(true);
    }
  });
});
