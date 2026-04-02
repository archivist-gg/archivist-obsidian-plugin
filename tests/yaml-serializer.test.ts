import { describe, it, expect } from "vitest";
import { editableToYaml } from "../src/dnd/yaml-serializer";
import { monsterToEditable } from "../src/dnd/editable-monster";
import type { Monster } from "../src/types/monster";
import * as yaml from "js-yaml";

const GOBLIN: Monster = {
  name: "Goblin", size: "Small", type: "Humanoid", alignment: "Neutral Evil",
  cr: "1/4",
  ac: [{ ac: 15, from: ["leather armor", "shield"] }],
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  saves: { dex: 4 },
  skills: { Stealth: 6 },
  senses: ["darkvision 60 ft."],
  passive_perception: 9,
  languages: ["Common", "Goblin"],
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("editableToYaml", () => {
  it("produces valid YAML that can be parsed back", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    expect(parsed.name).toBe("Goblin");
    expect(parsed.size).toBe("Small");
    expect(parsed.cr).toBe("1/4");
  });

  it("includes all non-empty fields", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    expect(yamlStr).toContain("name: Goblin");
    expect(yamlStr).toContain("size: Small");
    expect(yamlStr).toContain("ac:");
    expect(yamlStr).toContain("hp:");
    expect(yamlStr).toContain("abilities:");
    expect(yamlStr).toContain("actions:");
  });

  it("does not include EditableMonster-only fields", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    expect(yamlStr).not.toContain("overrides");
    expect(yamlStr).not.toContain("saveProficiencies");
    expect(yamlStr).not.toContain("skillProficiencies");
    expect(yamlStr).not.toContain("activeSenses");
    expect(yamlStr).not.toContain("customSenses");
    expect(yamlStr).not.toContain("activeSections");
    expect(yamlStr).not.toContain("proficiencyBonus");
  });

  it("round-trips through parser", () => {
    const editable = monsterToEditable(GOBLIN);
    const yamlStr = editableToYaml(editable);
    const parsed = yaml.load(yamlStr) as Record<string, unknown>;
    expect((parsed.abilities as Record<string, number>).dex).toBe(14);
    expect((parsed.hp as Record<string, unknown>).average).toBe(7);
  });
});
