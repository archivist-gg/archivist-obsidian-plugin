import { describe, it, expect } from "vitest";
import { monsterToEditable, editableToMonster } from "../src/modules/monster/monster.edit-state";
import type { Monster } from "../src/modules/monster/monster.types";

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
  traits: [{ name: "Nimble Escape", entries: ["The goblin can take the Disengage or Hide action as a bonus action."] }],
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit, reach 5 ft. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("monsterToEditable", () => {
  it("preserves all base monster fields", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.name).toBe("Goblin");
    expect(editable.size).toBe("Small");
    expect(editable.cr).toBe("1/4");
    expect(editable.abilities?.dex).toBe(14);
  });
  it("initializes empty overrides set", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.overrides.size).toBe(0);
  });
  it("infers DEX save proficiency from existing saves", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.saveProficiencies["dex"]).toBe(true);
    expect(editable.saveProficiencies["str"]).toBe(false);
  });
  it("infers Stealth expertise from skill value exceeding prof+mod", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.skillProficiencies["stealth"]).toBe("expertise");
  });
  it("detects active senses", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.activeSenses["darkvision"]).toBe("60 ft.");
    expect(editable.activeSenses["blindsight"]).toBeNull();
  });
  it("detects active sections from traits/actions", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.activeSections).toContain("traits");
    expect(editable.activeSections).toContain("actions");
    expect(editable.activeSections).not.toContain("legendary");
  });
  it("calculates proficiency bonus from CR", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.proficiencyBonus).toBe(2);
  });
  it("calculates XP from CR", () => {
    const editable = monsterToEditable(GOBLIN);
    expect(editable.xp).toBe(50);
  });
});

describe("editableToMonster", () => {
  it("round-trips: monsterToEditable -> editableToMonster preserves data", () => {
    const editable = monsterToEditable(GOBLIN);
    const monster = editableToMonster(editable);
    expect(monster.name).toBe("Goblin");
    expect(monster.ac).toEqual([{ ac: 15, from: ["leather armor", "shield"] }]);
    expect(monster.hp?.average).toBe(7);
    expect(monster.hp?.formula).toBe("2d6");
    expect(monster.abilities?.dex).toBe(14);
    expect(monster.actions).toHaveLength(1);
    expect(monster.traits).toHaveLength(1);
  });
  it("recalculates saves from proficiency toggles", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.saveProficiencies["str"] = true;
    const monster = editableToMonster(editable);
    expect(monster.saves?.["str"]).toBe(1); // -1 + 2
    expect(monster.saves?.["dex"]).toBe(4); // +2 + 2
  });
  it("recalculates skills from proficiency toggles", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.skillProficiencies["perception"] = "proficient";
    const monster = editableToMonster(editable);
    expect(monster.skills?.["Perception"]).toBe(1); // WIS(-1) + prof(2)
  });
  it("omits empty sections", () => {
    const editable = monsterToEditable(GOBLIN);
    const monster = editableToMonster(editable);
    expect(monster.legendary).toBeUndefined();
    expect(monster.reactions).toBeUndefined();
  });
});
