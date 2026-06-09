import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { characterSchema } from "../src/modules/pc/pc.schema";
import type { Character } from "../src/modules/pc/pc.types";
import type { Ability } from "../src/shared/types";

function makeChar(overrides: Record<string, unknown> = {}): Character {
  return characterSchema.parse({
    name: "Untitled",
    edition: "2014",
    class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    state: { hp: { current: 0, max: 0, temp: 0 } },
    ...overrides,
  }) as Character;
}

function makeState(char: Character, onChange = vi.fn(), registry: unknown = null) {
  const es = new CharacterEditState(
    char,
    () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }),
    onChange,
    registry as never,
  );
  return { es, onChange };
}

describe("CharacterEditState — identity mutators (SP2)", () => {
  it("setName trims and writes name, fires onChange", () => {
    const { es, onChange } = makeState(makeChar());
    es.setName("  Valeria  ");
    expect(es.getCharacter().name).toBe("Valeria");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setName ignores blank input (no write, no notify)", () => {
    const { es, onChange } = makeState(makeChar({ name: "Keep" }));
    es.setName("   ");
    expect(es.getCharacter().name).toBe("Keep");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setRace wraps a bare slug as a wikilink", () => {
    const { es } = makeState(makeChar());
    es.setRace("srd-5e_half-elf");
    expect(es.getCharacter().race).toBe("[[srd-5e_half-elf]]");
  });

  it("setRace leaves an existing wikilink intact, and null clears", () => {
    const { es } = makeState(makeChar());
    es.setRace("[[srd-5e_elf]]");
    expect(es.getCharacter().race).toBe("[[srd-5e_elf]]");
    es.setRace(null);
    expect(es.getCharacter().race).toBeNull();
  });

  it("setBackground and setSubrace wrap slugs; setAlignment sets/clears", () => {
    const { es } = makeState(makeChar());
    es.setBackground("srd-2024_criminal");
    es.setSubrace("srd-5e_high-elf");
    es.setAlignment("Chaotic Good");
    expect(es.getCharacter().background).toBe("[[srd-2024_criminal]]");
    expect(es.getCharacter().subrace).toBe("[[srd-5e_high-elf]]");
    expect(es.getCharacter().alignment).toBe("Chaotic Good");
    es.setAlignment(null);
    expect(es.getCharacter().alignment).toBeUndefined();
  });
});

describe("CharacterEditState — ability mutators (SP2)", () => {
  it("setAbilityMethod writes the method", () => {
    const { es } = makeState(makeChar());
    es.setAbilityMethod("point-buy");
    expect(es.getCharacter().ability_method).toBe("point-buy");
  });

  it("setAbilityBaseScore writes the BASE score (not an override), rounds, fires onChange", () => {
    const { es, onChange } = makeState(makeChar());
    es.setAbilityBaseScore("dex" as Ability, 15);
    expect(es.getCharacter().abilities.dex).toBe(15);
    expect(es.getCharacter().overrides.scores).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
    es.setAbilityBaseScore("dex" as Ability, 14.6);
    expect(es.getCharacter().abilities.dex).toBe(15);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("setAbilityBaseScore ignores non-finite input", () => {
    const { es, onChange } = makeState(makeChar());
    es.setAbilityBaseScore("str" as Ability, Number.NaN);
    expect(es.getCharacter().abilities.str).toBe(10);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CharacterEditState — class-entry mutators (SP2)", () => {
  it("addClass appends a wrapped entry with clamped level and null subclass", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_rogue", 9);
    const cls = es.getCharacter().class;
    expect(cls).toHaveLength(1);
    expect(cls[0]).toMatchObject({ name: "[[srd-5e_rogue]]", level: 9, subclass: null, choices: {} });
    es.addClass("srd-5e_cleric", 3, "srd-5e_life");
    expect(es.getCharacter().class[1].subclass).toBe("[[srd-5e_life]]");
  });

  it("addClass clamps level to 1..20", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_fighter", 99);
    expect(es.getCharacter().class[0].level).toBe(20);
    es.setClassLevel(0, -3);
    expect(es.getCharacter().class[0].level).toBe(1);
    es.setClassLevel(0, 9.7);
    expect(es.getCharacter().class[0].level).toBe(10);
  });

  it("setClassLevel and setSubclass update the right entry; removeClass splices", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_rogue", 1);
    es.addClass("srd-5e_wizard", 1);
    es.setClassLevel(0, 9);
    es.setSubclass(0, "srd-5e_soulknife");
    expect(es.getCharacter().class[0]).toMatchObject({ level: 9, subclass: "[[srd-5e_soulknife]]" });
    es.removeClass(1);
    expect(es.getCharacter().class).toHaveLength(1);
    expect(es.getCharacter().class[0].name).toBe("[[srd-5e_rogue]]");
  });

  it("out-of-range indices are no-ops", () => {
    const { es, onChange } = makeState(makeChar());
    es.setClassLevel(5, 3);
    es.removeClass(5);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CharacterEditState — setChoice (SP2 decision data)", () => {
  it("writes choices[level][key] = value on the right class entry", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_rogue", 9);
    es.setChoice(0, 1, "skills", ["stealth", "deception"]);
    es.setChoice(0, 4, "feat", "[[srd-5e_alert]]");
    const choices = es.getCharacter().class[0].choices as Record<number, Record<string, unknown>>;
    expect(choices[1].skills).toEqual(["stealth", "deception"]);
    expect(choices[4].feat).toBe("[[srd-5e_alert]]");
  });

  it("clears a key when value is null/undefined and prunes nothing else", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_rogue", 9);
    es.setChoice(0, 4, "feat", "[[x]]");
    es.setChoice(0, 4, "asi", { dex: 2 });
    es.setChoice(0, 4, "feat", null);
    const lvl4 = (es.getCharacter().class[0].choices as Record<number, Record<string, unknown>>)[4];
    expect("feat" in lvl4).toBe(false);
    expect(lvl4.asi).toEqual({ dex: 2 });
  });
});
