import { describe, it, expect } from "vitest";
import { parseMonster } from "../src/modules/monster/monster.parser";

describe("parseMonster", () => {
  it("parses a minimal monster (name only)", () => {
    const result = parseMonster("name: Goblin");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Goblin");
    }
  });

  it("fails when name is missing", () => {
    const result = parseMonster("size: Medium");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("name");
    }
  });

  it("parses a full monster", () => {
    const yaml = `
name: Goblin
size: Small
type: Humanoid
alignment: Neutral Evil
cr: "1/4"
ac:
  - ac: 15
    from: [leather armor, shield]
hp:
  average: 7
  formula: 2d6
speed:
  walk: 30
abilities:
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
skills:
  Stealth: 6
senses: [darkvision 60 ft.]
passive_perception: 9
languages: [Common, Goblin]
traits:
  - name: Nimble Escape
    entries:
      - The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
actions:
  - name: Scimitar
    entries:
      - "Melee Weapon Attack: +4 to hit, reach 5 ft., one target."
`;
    const result = parseMonster(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const m = result.data;
      expect(m.name).toBe("Goblin");
      expect(m.size).toBe("Small");
      expect(m.cr).toBe("1/4");
      expect(m.ac?.[0].ac).toBe(15);
      expect(m.ac?.[0].from).toEqual(["leather armor", "shield"]);
      expect(m.hp?.average).toBe(7);
      expect(m.speed?.walk).toBe(30);
      expect(m.abilities?.str).toBe(8);
      expect(m.abilities?.dex).toBe(14);
      expect(m.skills?.Stealth).toBe(6);
      expect(m.traits?.length).toBe(1);
      expect(m.traits?.[0].name).toBe("Nimble Escape");
      expect(m.actions?.length).toBe(1);
    }
  });

  it("fails on invalid YAML", () => {
    const result = parseMonster("name: [invalid: yaml: {{");
    expect(result.success).toBe(false);
  });

  it("coerces cr to string", () => {
    const result = parseMonster("name: Test\ncr: 5");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cr).toBe("5");
    }
  });
});
