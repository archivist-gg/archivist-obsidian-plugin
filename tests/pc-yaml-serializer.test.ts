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

  it("emits NO builder: key when the flag is absent (finished/legacy file)", () => {
    const c = parseMinimal();
    expect(c.builder).toBeUndefined();
    const dumped = characterToYaml(c);
    // js-yaml omits undefined keys — a finished character carries no builder line.
    expect(dumped).not.toMatch(/^builder:/m);
    expect(dumped).not.toContain("builder:");
  });

  it("emits builder: true while the draft flag is set, and drops it once cleared", () => {
    const c = parseMinimal();
    c.builder = true;
    expect(characterToYaml(c)).toMatch(/^builder:\s*true$/m);
    // Mirrors finishBuild(): deleting the key removes it from serialization.
    delete c.builder;
    expect(characterToYaml(c)).not.toContain("builder:");
  });

  it("round-trips a draft with builder_rolls (the persisted Roll pool), and drops it once cleared", () => {
    const c = parseMinimal();
    c.builder = true;
    c.ability_method = "rolled";
    c.builder_rolls = [15, 14, 13, 12, 10, 8];
    const once = characterToYaml(c);
    expect(once).toContain("builder_rolls:");
    // Parses straight back to the same array (no key loss, no length pin).
    const reparsed = parsePC(once);
    if (!reparsed.success) throw new Error(reparsed.error);
    expect(reparsed.data.builder_rolls).toEqual([15, 14, 13, 12, 10, 8]);
    // A second serialize-then-reparse pass is structurally stable.
    const twice = parsePC(characterToYaml(reparsed.data));
    if (!twice.success) throw new Error(twice.error);
    expect(twice.data.builder_rolls).toEqual([15, 14, 13, 12, 10, 8]);
    // Mirrors finishBuild(): deleting the key removes it from serialization.
    delete c.builder_rolls;
    expect(characterToYaml(c)).not.toContain("builder_rolls:");
  });
});
