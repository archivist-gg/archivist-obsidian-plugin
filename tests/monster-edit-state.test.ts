import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { MonsterEditState } from "../packages/obsidian/src/modules/monster/monster.edit-state";
import { getFeatures } from "../packages/obsidian/src/modules/monster/edit/traits-editor";
import { SECTION_KEY_MAP } from "../packages/obsidian/src/modules/monster/edit/types";

/** `Monster.traits` is `Feature[] | undefined` and `lair_actions` is `unknown[] | undefined` (strictNullChecks). */
const names = (a: unknown): string[] => ((a as { name: string }[] | undefined) ?? []).map((f) => f.name);

describe("MonsterEditState: Cancel reverts a feature edit (R4-G6b §4.4)", () => {
  it("adding a feature never mutates the original, and cancel() reverts it (R4-G6b §4.4)", () => {
    const m = { name: "x", traits: [{ name: "t", entries: ["e"] }], lair_actions: [{ name: "l", entries: ["e"] }] } as never;
    const s = new MonsterEditState(m, () => {});
    s.addFeature("traits");
    expect((m as never as { traits: unknown[] }).traits.length).toBe(1);          // m10's kill row: the original is never mutated
    s.cancel();
    expect(names(s.current.traits)).toEqual(["t"]);
    s.addFeature("lair_actions");
    expect((m as never as { lair_actions: unknown[] }).lair_actions.length).toBe(1);
    s.cancel();
    expect(names(s.current.lair_actions)).toEqual(["l"]);
  });
});

/**
 * The SHIPPED shape of `lair_actions` (T5 review, R4-G6b §4.4). MEASURED over the converter output: all 222 notes
 * carrying the key start with a SCALAR string or a `{ type: list, items: [...] }` node, never a `{ name, entries }`
 * feature (e.g. `Monster Manual (2014)/Monsters/Beholder.md`). Spreading such an entry yields a per-character object,
 * and a truthiness test on a scalar value throws at open, so the deep copy must copy PLAIN OBJECTS only.
 */
describe("monsterToEditable copies only plain-object section entries (R4-G6b §4.4, T5 review)", () => {
  it("a shipped lair_actions array round-trips: a scalar entry, a list node, and the saved YAML", () => {
    const authored = ["The beholder's eye rays.", { type: "list", items: ["a", "b"] }];
    const m = { name: "Beholder", lair_actions: authored } as never;
    const s = new MonsterEditState(m, () => {});
    const lair = s.current.lair_actions as unknown[];
    expect(lair[0]).toBe("The beholder's eye rays.");                       // the kill: a spread string is per-character
    expect(lair[1]).toEqual({ type: "list", items: ["a", "b"] });
    expect((yaml.load(s.toYaml()) as { lair_actions: unknown }).lair_actions).toEqual(authored);
  });

  it("an authored scalar lair_actions does not throw at open and round-trips", () => {
    const m = { name: "Aboleth", lair_actions: "some text" } as never;
    const s = new MonsterEditState(m, () => {});
    // R4-G7 §7.4 (a): the value LEAVES the editable, so no reader can mistake it for a feature array. R4-G6 §9
    // invariant 7 is unchanged: `editableToMonster`'s re-emit puts it back on the save, byte for byte.
    expect(s.current.lair_actions).toBeUndefined();
    expect((yaml.load(s.toYaml()) as { lair_actions: unknown }).lair_actions).toBe("some text");
  });
});

/**
 * R4-G7 §7.4 · the section READER. `getFeatures` is the only exported reader of a section array, and it answered
 * whatever sat under the key: an authored scalar came straight back cast as `Feature[]`, so the tab rendered one
 * blank feature card per CHARACTER of the string. The hardening is a shape test, not a truthiness test.
 */
describe("getFeatures never hands a scalar section value back as Feature[] (R4-G7 §7.4)", () => {
  it("a scalar traits value reads as an empty active section, never as the string", () => {
    const m = { name: "Aboleth", traits: "some text" } as never;
    const s = new MonsterEditState(m, () => {});
    expect(getFeatures(s.current, "traits")).toEqual([]);          // the kill: the string came back cast
    // `monsterToEditable` opens the tab because a 9-character string passes its `length > 0` test.
    expect(s.current.activeSections).toContain("traits");
    // An INACTIVE section still answers `undefined`, which is what suppresses the tab's body entirely.
    expect(getFeatures(s.current, "mythic_actions")).toBeUndefined();
  });

  it("an active section with no array yet still answers [] so the add button renders", () => {
    const s = new MonsterEditState({ name: "Aboleth" } as never, () => {});
    s.addSection("lair_actions");
    expect(getFeatures(s.current, "lair_actions")).toEqual([]);
  });
});

/**
 * R4-G7 §7.4 · the element copy is narrowed to a PLAIN-object test. `typeof f === "object"` is true for every
 * non-null object, so a js-yaml `Date` (an unquoted ISO scalar in the note) was spread to `{}` and the authored
 * value was destroyed on the next save. Only an entry whose prototype IS `Object.prototype` is a `{name, entries}`
 * feature the editors write into; everything else rides by reference, nothing writes into it.
 */
describe("monsterToEditable copies plain objects only, so a Date rides by reference (R4-G7 §7.4)", () => {
  it("a Date entry survives; a plain-object entry is still copied", () => {
    const when = new Date("2026-09-10T00:00:00.000Z");
    const authored: unknown[] = [when, { name: "l", entries: ["e"] }];
    const m = { name: "Aboleth", lair_actions: authored } as never;
    const s = new MonsterEditState(m, () => {});
    const lair = s.current.lair_actions as unknown[];
    expect(lair[0]).toBe(when);                                    // m11's kill row: the spread yields {}
    expect(lair[1]).toEqual({ name: "l", entries: ["e"] });
    expect(lair[1]).not.toBe(authored[1]);                         // and the plain object is still a COPY
  });
});

/**
 * R4-G7 §7.4 (a) under R4-G6 §9 invariant 7 · a non-array value under a section key is DELETED from the editable
 * at the copy site, so no reader (the shape-testing `getFeatures`, and `MonsterEditState.addFeature`, which reads
 * the key directly and would `.push` on a truthy string) can ever treat it as a feature array; and
 * `editableToMonster` re-emits it from `extras`, so the save stays lossless. Measured population of such a value
 * in the shipped corpus: ZERO (`evidence/g7-t3-section-scalar-population.txt`), so this is a hardening for
 * hand-authored and homebrew notes, not a repair of shipped data.
 */
describe("a scalar section value leaves the editable and still reaches the save (R4-G7 §7.4 (a))", () => {
  it("a scalar traits value is off the editable, reads as an empty active section, and still round-trips", () => {
    const m = { name: "Aboleth", traits: "some text" } as never;
    const s = new MonsterEditState(m, () => {});
    expect(s.current.traits).toBeUndefined();                                  // the kill: the string survived
    expect(getFeatures(s.current, "traits")).toEqual([]);
    expect(s.current.activeSections).toContain("traits");                      // a 9-character string opens the tab
    expect((yaml.load(s.toYaml()) as { traits: unknown }).traits).toBe("some text");   // invariant 7
    // No section key carries a string any more, which is what makes `addFeature`'s direct read safe.
    for (const k of Object.values(SECTION_KEY_MAP)) {
      expect(typeof (s.current as unknown as Record<string, unknown>)[k]).not.toBe("string");
    }
  });

  it("addFeature on such a section can no longer push onto a string", () => {
    const s = new MonsterEditState({ name: "Aboleth", traits: "some text" } as never, () => {});
    expect(() => s.addFeature("traits")).not.toThrow();                        // the kill: TypeError on a string
    expect((s.current.traits as unknown as unknown[]).length).toBe(1);
  });

  it("the re-emit keeps an unmanaged scalar section value in the save (invariant 7)", () => {
    const s = new MonsterEditState({ name: "Aboleth", mythic_actions: "some text" } as never, () => {});
    expect((yaml.load(s.toYaml()) as { mythic_actions: unknown }).mythic_actions).toBe("some text");  // m12's kill row
    expect((s.current as unknown as Record<string, unknown>).mythic_actions).toBeUndefined();
  });

  it("CONTROL: a section the user empties in the editor is never resurrected by the re-emit", () => {
    // Green by construction, and that is the point: the re-emit fires only when the key is ABSENT on the editable,
    // never when it is an array, so a deliberate clear-to-[] is not undone by the authored value.
    const m = { name: "Aboleth", traits: [{ name: "t", entries: ["e"] }], lair_actions: ["x"] } as never;
    const s = new MonsterEditState(m, () => {});
    s.removeSection("traits");
    s.removeSection("lair_actions");
    const out = yaml.load(s.toYaml()) as Record<string, unknown>;
    expect(out.traits).toBeUndefined();          // a managed section: dropped entirely
    expect(out.lair_actions).toEqual([]);        // an unmanaged one: the cleared array, not the authored ["x"]
  });
});
