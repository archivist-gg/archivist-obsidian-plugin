import { describe, it, expect } from "vitest";
import { parsePC } from "../src/modules/pc/pc.parser";
import { characterToYaml } from "../src/modules/pc/pc.yaml-serializer";

const baseYaml = `
name: T
edition: "2014"
race: null
subrace: null
background: null
class:
  - name: fighter
    level: 1
    subclass: null
    choices: {}
abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
ability_method: manual
skills: { proficient: [], expertise: [] }
spells: { known: [], overrides: [] }
equipment: []
overrides: {}
state:
  hp: { current: 10, max: 10, temp: 0 }
  hit_dice: {}
  spell_slots: {}
  concentration: null
  conditions: []
  inspiration: 0
  exhaustion: 0
  death_saves: { successes: 0, failures: 0 }
`;

describe("currency migration", () => {
  it("legacy state.currency lifts to definition.currency", () => {
    const r = parsePC(baseYaml + "  currency: { cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 }\n");
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.currency).toEqual({ cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 });
      expect(r.data.state).not.toHaveProperty("currency");
    }
  });

  it("definition.currency wins when both present", () => {
    const r = parsePC(
      baseYaml.replace("equipment: []\n", "equipment: []\ncurrency: { cp: 0, sp: 0, ep: 0, gp: 200, pp: 0 }\n")
        + "  currency: { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 }\n"
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.currency!.gp).toBe(200);
      expect(r.data.state).not.toHaveProperty("currency");
    }
  });

  it("legacy state.attuned_items is dropped", () => {
    const r = parsePC(baseYaml + '  attuned_items: ["foo", "bar"]\n');
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.state).not.toHaveProperty("attuned_items");
    }
  });

  it("characterToYaml emits currency at top, never under state", () => {
    const r = parsePC(baseYaml + "  currency: { cp: 0, sp: 0, ep: 0, gp: 99, pp: 0 }\n");
    if (!r.success) throw new Error(r.error);
    const y = characterToYaml(r.data);
    // currency line appears before "state:" line
    const currencyIdx = y.indexOf("\ncurrency:");
    const stateIdx = y.indexOf("\nstate:");
    expect(currencyIdx).toBeGreaterThan(-1);
    expect(stateIdx).toBeGreaterThan(currencyIdx);
    expect(y).not.toMatch(/state:[\s\S]*currency:/);
  });
});
