import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { MonsterEditState } from "../packages/obsidian/src/modules/monster/monster.edit-state";
import { getFeatures } from "../packages/obsidian/src/modules/monster/edit/traits-editor";

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
    expect(s.current.lair_actions).toBe("some text");
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
