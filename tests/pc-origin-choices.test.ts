import { describe, it, expect, vi } from "vitest";
import { characterSchema } from "@archivist-gg/dnd5e/pc/pc.schema";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

// The schema requires `state.hp`; this is the smallest input it accepts.
const minimal = {
  name: "T", edition: "2024",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  state: { hp: { current: 0, max: 0, temp: 0 } },
};

describe("origin_choices + typed class choices", () => {
  it("defaults origin_choices to {} (existing files untouched)", () => {
    const r = characterSchema.safeParse(minimal);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.origin_choices).toEqual({});
  });

  it("accepts namespaced origin selections", () => {
    const r = characterSchema.safeParse({
      ...minimal,
      origin_choices: { "background:languages": ["elvish", "dwarvish"], "race:skills": ["insight"] },
    });
    expect(r.success).toBe(true);
  });

  it("keeps legacy per-level choice values (string / array / asi record)", () => {
    const r = characterSchema.safeParse({
      ...minimal,
      class: [{ name: "[[fighter]]", level: 4, choices: {
        1: { skills: ["athletics", "perception"], "fighting-style": "defense" },
        4: { "asi-or-feat": "asi", asi: { str: 1, con: 1 } },
      } }],
    });
    expect(r.success).toBe(true);
  });

  it("never fails the character parse on legacy/hand-edited oddities", () => {
    const cases = [
      { 1: { a: null } },
      { 1: { b: 7 } },
      { 1: { c: [1, 2] } },
      { 1: { d: true } },
      { 1: null },
      { 1: "loose" },
    ];
    for (const choices of cases) {
      const r = characterSchema.safeParse({
        ...minimal,
        class: [{ name: "[[fighter]]", level: 4, choices }],
      });
      expect(r.success, JSON.stringify(choices)).toBe(true);
    }
  });

  it("preserves odd legacy choice values unchanged (round-trips, not just parses)", () => {
    // The schema's `.catch` arms must pass the ORIGINAL value through, not
    // drop it. A value-dropping fallback (e.g. `.catch(() => ({}))`) would
    // still pass the success-only assertions above while silently rewriting
    // users' hand-edited data on save — these deep-equals pin that contract.
    // (Zod stringifies record keys, so output keys are `"1"`, but toEqual
    // treats `{1: ...}` and `{"1": ...}` as equal for plain objects.)
    const r1 = characterSchema.safeParse({
      ...minimal,
      class: [{ name: "[[fighter]]", level: 4, choices: { 1: null } }],
    });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.class[0].choices).toEqual({ 1: null });

    const r2 = characterSchema.safeParse({
      ...minimal,
      class: [{ name: "[[fighter]]", level: 4, choices: { 1: { a: null, b: 7 } } }],
    });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.class[0].choices).toEqual({ 1: { a: null, b: 7 } });

    const r3 = characterSchema.safeParse({
      ...minimal,
      origin_choices: { "race:odd": 42 },
    });
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data.origin_choices!["race:odd"]).toBe(42);
  });
});

describe("CharacterEditState — setOriginChoice", () => {
  function makeChar(overrides: Record<string, unknown> = {}): Character {
    return characterSchema.parse({ ...minimal, ...overrides }) as Character;
  }

  function makeState(char: Character, onChange = vi.fn()) {
    const es = new CharacterEditState(
      char,
      () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }),
      onChange,
      null as never,
    );
    return { es, onChange };
  }

  it("sets origin_choices[key] = value and fires onChange", () => {
    const { es, onChange } = makeState(makeChar());
    es.setOriginChoice("background:languages", ["elvish", "dwarvish"]);
    expect(es.getCharacter().origin_choices).toEqual({ "background:languages": ["elvish", "dwarvish"] });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("clears a key when value is null and prunes only that key", () => {
    const { es } = makeState(makeChar());
    es.setOriginChoice("race:skills", ["insight"]);
    es.setOriginChoice("background:languages", "elvish");
    es.setOriginChoice("race:skills", null);
    const oc = es.getCharacter().origin_choices!;
    expect("race:skills" in oc).toBe(false);
    expect(oc["background:languages"]).toBe("elvish");
  });
});
