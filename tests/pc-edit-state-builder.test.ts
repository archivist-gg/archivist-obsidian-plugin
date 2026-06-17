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

describe("CharacterEditState — finishBuild (SP2 Plan 3)", () => {
  it("deletes the builder draft flag and fires onChange", () => {
    const { es, onChange } = makeState(makeChar({ builder: true }));
    expect(es.getCharacter().builder).toBe(true);
    es.finishBuild();
    expect(es.getCharacter().builder).toBeUndefined();
    expect("builder" in es.getCharacter()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is a safe no-throw on a character with no builder flag (still notifies)", () => {
    const { es, onChange } = makeState(makeChar());
    expect(es.getCharacter().builder).toBeUndefined();
    expect(() => es.finishBuild()).not.toThrow();
    expect(es.getCharacter().builder).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("also deletes the persisted builder_rolls pool (finished file carries no draft scratch)", () => {
    const { es } = makeState(makeChar({ builder: true, ability_method: "rolled", builder_rolls: [15, 14, 13, 12, 10, 8] }));
    expect(es.getCharacter().builder_rolls).toEqual([15, 14, 13, 12, 10, 8]);
    es.finishBuild();
    expect(es.getCharacter().builder_rolls).toBeUndefined();
    expect("builder_rolls" in es.getCharacter()).toBe(false);
  });
});

describe("CharacterEditState — openBuilder (Manage & Level Up)", () => {
  it("sets the builder draft flag and fires onChange", () => {
    const { es, onChange } = makeState(makeChar());
    expect(es.getCharacter().builder).toBeUndefined();
    es.openBuilder();
    expect(es.getCharacter().builder).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when already in builder mode (still notifies)", () => {
    const { es, onChange } = makeState(makeChar({ builder: true }));
    es.openBuilder();
    expect(es.getCharacter().builder).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — setBuilderRolls (SP2 Plan 5)", () => {
  it("writes the rolled pool onto the draft, rounds, fires onChange", () => {
    const { es, onChange } = makeState(makeChar({ ability_method: "rolled" }));
    es.setBuilderRolls([15, 14.6, 13, 12, 10, 8]);
    expect(es.getCharacter().builder_rolls).toEqual([15, 15, 13, 12, 10, 8]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("a re-roll overwrites the prior pool", () => {
    const { es } = makeState(makeChar({ ability_method: "rolled", builder_rolls: [9, 9, 9, 9, 9, 9] }));
    es.setBuilderRolls([16, 15, 14, 13, 12, 11]);
    expect(es.getCharacter().builder_rolls).toEqual([16, 15, 14, 13, 12, 11]);
  });

  it("ignores a non-finite member (no write, no notify)", () => {
    const { es, onChange } = makeState(makeChar({ ability_method: "rolled" }));
    es.setBuilderRolls([15, Number.NaN, 13]);
    expect(es.getCharacter().builder_rolls).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
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

  it("clearAbilityBaseScore resets the BASE score to the neutral 10 sentinel and fires onChange", () => {
    // abilities is Record<Ability, number> (no null arm), so "unassigned" is 10.
    const { es, onChange } = makeState(makeChar());
    es.setAbilityBaseScore("dex" as Ability, 15);
    es.clearAbilityBaseScore("dex" as Ability);
    expect(es.getCharacter().abilities.dex).toBe(10);
    expect(es.getCharacter().overrides.scores).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(2);
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

  it("prunes the empty level-object when its last key is cleared", () => {
    const { es } = makeState(makeChar());
    es.addClass("srd-5e_rogue", 9);
    es.setChoice(0, 4, "feat", "[[x]]");
    es.setChoice(0, 4, "feat", null);
    const choices = es.getCharacter().class[0].choices as Record<number, Record<string, unknown>>;
    expect(4 in choices).toBe(false);
    expect(Object.keys(choices)).toHaveLength(0);
  });

  it("out-of-range classIndex / non-finite level are no-ops", () => {
    const { es, onChange } = makeState(makeChar());
    es.setChoice(5, 1, "skills", ["x"]); // no class at index 5
    expect(onChange).not.toHaveBeenCalled();
    es.addClass("srd-5e_rogue", 9);
    onChange.mockClear();
    es.setChoice(0, Number.NaN, "skills", ["x"]); // non-finite level
    expect(onChange).not.toHaveBeenCalled();
    expect(es.getCharacter().class[0].choices).toEqual({});
  });
});

describe("CharacterEditState — state seeders (SP2)", () => {
  it("seedHpToMax sets hp.current = max = derived max, temp 0", () => {
    const char = makeChar();
    const onChange = vi.fn();
    const es = new CharacterEditState(
      char,
      () => ({ resolved: { definition: char } as never, derived: { hp: { max: 63 } } as never }),
      onChange,
      null as never,
    );
    es.seedHpToMax();
    expect(es.getCharacter().state.hp).toMatchObject({ current: 63, max: 63, temp: 0 });
  });

  it("seedHitDice sums class levels per die from the registry", () => {
    const char = makeChar();
    // The real EntityRegistry.getByTypeAndSlug returns a RegisteredEntity
    // ({ data: { ... } }) or undefined on miss — the class's hit_die lives in
    // entity.data.hit_die.
    const registry = {
      getByTypeAndSlug: (type: string, slug: string) =>
        type === "class" && slug === "srd-5e_rogue" ? { data: { hit_die: "d8" } } : undefined,
    };
    const es = new CharacterEditState(
      char,
      () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }),
      vi.fn(),
      registry as never,
    );
    es.addClass("srd-5e_rogue", 9);
    es.seedHitDice();
    expect(es.getCharacter().state.hit_dice).toEqual({ d8: { used: 0, total: 9 } });
  });

  it("seedHitDice aggregates a multiclass: same dice sum, different dice split", () => {
    const char = makeChar();
    // dieForClass normalizes "d12" (string) and 10 (number, exercises the
    // number branch) to a "dN" key; an unknown slug misses (returns undefined).
    const dice: Record<string, { data: { hit_die: unknown } }> = {
      "srd-5e_barbarian": { data: { hit_die: "d12" } },
      "srd-5e_fighter": { data: { hit_die: 10 } },
      "srd-5e_blood-hunter": { data: { hit_die: "d12" } },
    };
    const registry = {
      getByTypeAndSlug: (type: string, slug: string) =>
        type === "class" ? dice[slug] : undefined,
    };
    const es = new CharacterEditState(
      char,
      () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }),
      vi.fn(),
      registry as never,
    );
    es.addClass("srd-5e_barbarian", 3);
    es.addClass("srd-5e_fighter", 2);
    es.addClass("srd-5e_blood-hunter", 4); // second d12 → summed with barbarian
    es.seedHitDice();
    expect(es.getCharacter().state.hit_dice).toEqual({
      d12: { used: 0, total: 7 },
      d10: { used: 0, total: 2 },
    });
  });
});
