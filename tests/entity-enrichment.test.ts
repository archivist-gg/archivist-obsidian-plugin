import { describe, it, expect } from "vitest";
import { enrichMonster, enrichSpell, enrichItem } from "../src/ai/validation/entity-enrichment";

describe("enrichMonster", () => {
  it("calculates XP from CR", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "5",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    expect(result.xp).toBe(1800);
  });
  it("calculates proficiency bonus from CR", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "10",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    expect(result.proficiency_bonus).toBe(4);
  });
  it("computes passive perception from wisdom", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    });
    expect(result.passive_perception).toBe(12);
  });
  it("preserves explicit passive perception", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      passive_perception: 15,
    });
    expect(result.passive_perception).toBe(15);
  });
  it("defaults languages to ---", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    expect(result.languages).toEqual(["---"]);
  });
  it("preserves existing languages", () => {
    const result = enrichMonster({
      name: "Test",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      languages: ["Common", "Draconic"],
    });
    expect(result.languages).toEqual(["Common", "Draconic"]);
  });

  it("preserves entries with inline formula tags", () => {
    const result = enrichMonster({
      name: "Goblin",
      cr: "1/4",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      actions: [{
        name: "Scimitar",
        entries: ["Melee Weapon Attack: `atk:DEX` to hit, reach 5 ft., one target. Hit: `damage:1d6+DEX` slashing damage."],
      }],
    });
    expect(result.actions).toBeDefined();
    expect(result.actions[0].entries[0]).toContain("`atk:DEX`");
    expect(result.actions[0].entries[0]).toContain("`damage:1d6+DEX`");
  });
});

describe("enrichSpell", () => {
  it("detects concentration from duration", () => {
    const result = enrichSpell({
      name: "Test",
      duration: "Concentration, up to 1 minute",
    });
    expect(result.concentration).toBe(true);
  });
  it("defaults classes to Wizard, Sorcerer", () => {
    const result = enrichSpell({ name: "Test" });
    expect(result.classes).toEqual(["Wizard", "Sorcerer"]);
  });
  it("preserves existing classes", () => {
    const result = enrichSpell({ name: "Test", classes: ["Cleric"] });
    expect(result.classes).toEqual(["Cleric"]);
  });
});

describe("enrichItem", () => {
  it("defaults source to Homebrew", () => {
    const result = enrichItem({ name: "Test" });
    expect(result.source).toBe("Homebrew");
  });
  it("defaults attunement to false", () => {
    const result = enrichItem({ name: "Test" });
    expect(result.attunement).toBe(false);
  });
  it("preserves string attunement", () => {
    const result = enrichItem({ name: "Test", attunement: "by a cleric" });
    expect(result.attunement).toBe("by a cleric");
  });
});
