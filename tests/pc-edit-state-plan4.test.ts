import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { characterSchema } from "../src/modules/pc/pc.schema";
import type { Character } from "../src/modules/pc/pc.types";

function mkCharacter(over: Partial<Character> = {}): Character {
  return {
    name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [], overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
    ...over,
  } as Character;
}

function mkState(c: Character): { es: CharacterEditState; onChange: ReturnType<typeof vi.fn> } {
  const onChange = vi.fn();
  const es = new CharacterEditState(c, () => null as never, onChange);
  return { es, onChange };
}

describe("setRace — stale origin cleanup", () => {
  it("clears subrace and race-namespaced origin_choices, keeps background ones", () => {
    const c = mkCharacter({
      race: "[[srd-5e_dwarf]]", subrace: "[[hill-dwarf]]",
      origin_choices: { "race:draconic-ancestry": "red", "race:skills": ["perception"], "background:langs": ["elvish"] },
    });
    const { es } = mkState(c);
    es.setRace("srd-5e_elf");
    expect(c.race).toBe("[[srd-5e_elf]]");
    expect(c.subrace).toBeNull();
    expect(c.origin_choices).toEqual({ "background:langs": ["elvish"] });
  });

  it("clearing the race also prunes", () => {
    const c = mkCharacter({ race: "[[x]]", origin_choices: { "race:a": 1 } });
    mkState(c).es.setRace(null);
    expect(c.race).toBeNull();
    expect(c.origin_choices).toBeUndefined();
  });
});

describe("setBackground — stale origin cleanup", () => {
  it("prunes background-namespaced keys, keeps race ones", () => {
    const c = mkCharacter({
      background: "[[srd-5e_acolyte]]",
      origin_choices: { "background:langs": ["elvish"], "race:a": 1 },
    });
    mkState(c).es.setBackground("srd-2024_criminal");
    expect(c.origin_choices).toEqual({ "race:a": 1 });
  });
});

describe("setAge", () => {
  it("sets and clears the optional age", () => {
    const c = mkCharacter();
    const { es, onChange } = mkState(c);
    es.setAge("26");
    expect(c.age).toBe("26");
    es.setAge(null);
    expect(c.age).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("archivist-point-buy method", () => {
  it("setAbilityMethod accepts the new enum value", () => {
    const c = mkCharacter();
    mkState(c).es.setAbilityMethod("archivist-point-buy");
    expect(c.ability_method).toBe("archivist-point-buy");
  });
});

describe("schema — plan 4 fields", () => {
  it("accepts age and archivist-point-buy; both optional/absent stays valid", () => {
    const base = mkCharacter();
    expect(characterSchema.safeParse(base).success).toBe(true);
    expect(characterSchema.safeParse({ ...base, age: "26", ability_method: "archivist-point-buy" }).success).toBe(true);
  });
});
