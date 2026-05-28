import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { characterToYaml } from "../src/modules/pc/pc.yaml-serializer";
import { parsePC } from "../src/modules/pc/pc.parser";
import type { Character } from "../src/modules/pc/pc.types";

const MINIMAL_YAML = [
  "name: Grendal",
  "edition: '2014'",
  "race: null",
  "subrace: null",
  "background: null",
  "class:",
  "  - name: '[[bladesworn]]'",
  "    level: 3",
  "    subclass: null",
  "    choices: {}",
  "abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }",
  "ability_method: manual",
  "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }",
  "equipment: []",
  "overrides: {}",
  "state:",
  "  hp: { current: 24, max: 24, temp: 0 }",
  "  hit_dice: {}",
  "  spell_slots: {}",
  "  concentration: null",
  "  conditions: []",
  "  inspiration: 0",
].join("\n");

function parseMinimal(): Character {
  const result = parsePC(MINIMAL_YAML);
  if (!result.success) throw new Error(result.error);
  return result.data;
}

describe("characterToYaml", () => {
  it("produces a string that parses back to an equivalent struct", () => {
    const c = parseMinimal();
    const dumped = characterToYaml(c);
    const reparsed = yaml.load(dumped) as Record<string, unknown>;
    expect(reparsed.name).toBe("Grendal");
    expect((reparsed.state as Record<string, unknown>).hp).toEqual({ current: 24, max: 24, temp: 0 });
  });

  it("preserves insertion order — state is emitted after definition fields", () => {
    const c = parseMinimal();
    const dumped = characterToYaml(c);
    const nameIdx = dumped.indexOf("name:");
    const stateIdx = dumped.indexOf("state:");
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(stateIdx).toBeGreaterThan(nameIdx);
  });

  it("round-trips a mutated character identically on a second pass", () => {
    const c = parseMinimal();
    c.state.hp.current = 10;
    const once = characterToYaml(c);
    const reparsed = parsePC(once);
    if (!reparsed.success) throw new Error(reparsed.error);
    const twice = characterToYaml(reparsed.data);
    expect(once).toBe(twice);
  });

  it("emits no YAML refs (no &anchor / *alias)", () => {
    const c = parseMinimal();
    const dumped = characterToYaml(c);
    expect(dumped.match(/&\w+/)).toBeNull();
    expect(dumped.match(/\*\w+/)).toBeNull();
  });

  it("does not wrap long lines", () => {
    const c = parseMinimal();
    const longNote = "a".repeat(200);
    c.notes = longNote;
    const dumped = characterToYaml(c);
    expect(dumped).toContain(longNote);
  });
});
