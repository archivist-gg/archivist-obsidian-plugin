import { describe, it, expect } from "vitest";
import { recalculate, monsterToEditable } from "../src/modules/monster/monster.edit-state";
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
  actions: [{ name: "Scimitar", entries: ["Melee Weapon Attack: `atk:DEX` to hit. Hit: `damage:1d6+DEX` slashing."] }],
};

describe("recalculate", () => {
  it("recalculates HP when CON changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.con = 14;
    const result = recalculate(editable, "abilities.con");
    expect(result.hp?.average).toBe(11);
  });
  it("does NOT recalculate HP when HP is overridden", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.overrides.add("hp");
    editable.hp = { average: 15, formula: "2d6" };
    editable.abilities!.con = 14;
    const result = recalculate(editable, "abilities.con");
    expect(result.hp?.average).toBe(15);
  });
  it("recalculates saves when ability changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.dex = 16;
    const result = recalculate(editable, "abilities.dex");
    expect(result.saves?.["dex"]).toBe(5);
  });
  it("does NOT recalculate overridden saves", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.overrides.add("saves.dex");
    editable.abilities!.dex = 16;
    const result = recalculate(editable, "abilities.dex");
    expect(result.saves?.["dex"]).toBe(4);
  });
  it("recalculates proficiency bonus when CR changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.cr = "5";
    const result = recalculate(editable, "cr");
    expect(result.proficiencyBonus).toBe(3);
    expect(result.xp).toBe(1800);
    expect(result.saves?.["dex"]).toBe(5);
  });
  it("recalculates passive perception when WIS changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.wis = 14;
    const result = recalculate(editable, "abilities.wis");
    expect(result.passive_perception).toBe(12);
  });
  it("recalculates HP when size changes (hit dice size changes)", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.size = "Medium";
    const result = recalculate(editable, "size");
    expect(result.hp?.average).toBe(9);
    expect(result.hp?.formula).toBe("2d8");
  });
  it("recalculates skills when ability changes", () => {
    const editable = monsterToEditable(GOBLIN);
    editable.abilities!.dex = 16;
    const result = recalculate(editable, "abilities.dex");
    expect(result.skills?.["Stealth"]).toBe(7);
  });
});
