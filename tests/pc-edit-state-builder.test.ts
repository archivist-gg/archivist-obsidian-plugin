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
  });

  it("setAbilityBaseScore ignores non-finite input", () => {
    const { es, onChange } = makeState(makeChar());
    es.setAbilityBaseScore("str" as Ability, Number.NaN);
    expect(es.getCharacter().abilities.str).toBe(10);
    expect(onChange).not.toHaveBeenCalled();
  });
});
