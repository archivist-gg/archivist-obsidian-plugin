import { describe, it, expect } from "vitest";
import { MonsterEditState } from "../packages/obsidian/src/modules/monster/monster.edit-state";

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
