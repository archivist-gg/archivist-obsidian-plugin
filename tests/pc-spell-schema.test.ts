import { describe, it, expect } from "vitest";
import { parsePC } from "@archivist-gg/dnd5e/pc/pc.parser";

const BASE = [
  "name: Mage", "edition: '2014'", "race: null", "subrace: null", "background: null",
  "class:", "  - name: '[[wizard]]'", "    level: 5", "    subclass: null", "    choices: {}",
  "abilities: { str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10 }",
  "ability_method: manual", "skills: { proficient: [], expertise: [] }",
];

function yaml(spellsBlock: string[], stateExtra: string[] = [], overridesInline = "{}"): string {
  return [
    ...BASE, ...spellsBlock, "equipment: []", `overrides: ${overridesInline}`,
    "state:", "  hp: { current: 30, max: 30, temp: 0 }", "  hit_dice: { d6: { used: 0, total: 5 } }",
    "  spell_slots: {}", "  concentration: null", "  conditions: []", "  inspiration: 0", ...stateExtra,
  ].join("\n");
}

describe("PC schema — spells", () => {
  it("accepts a bare-slug known list (back-compat)", () => {
    const r = parsePC(yaml(["spells:", "  known: ['[[fire-bolt]]', '[[shield]]']", "  overrides: []"]));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.spells.known).toEqual(["[[fire-bolt]]", "[[shield]]"]);
  });

  it("accepts object-form known entries", () => {
    const r = parsePC(yaml([
      "spells:", "  view: table",
      "  known:",
      "    - '[[fire-bolt]]'",
      "    - spell: '[[fireball]]'",
      "      prepared: true",
      "    - spell: '[[cure-wounds]]'",
      "      class: '[[cleric]]'",
      "      source: domain",
      "      always_prepared: true",
      "  overrides: []",
    ]));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.spells.view).toBe("table");
      expect(r.data.spells.known[1]).toEqual({ spell: "[[fireball]]", prepared: true });
    }
  });

  it("accepts spell_slots_pact and overrides.spell_slots", () => {
    const r = parsePC(yaml(
      ["spells:", "  known: []", "  overrides: []"],
      ["  spell_slots_pact: { level: 3, used: 1, total: 2 }"],
      "{ spell_slots: { 1: 4, 2: 3 } }",
    ));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.state.spell_slots_pact).toEqual({ level: 3, used: 1, total: 2 });
      expect(r.data.overrides.spell_slots).toEqual({ 1: 4, 2: 3 });
    }
  });
});
