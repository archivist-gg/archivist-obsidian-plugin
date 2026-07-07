import { describe, it, expect } from "vitest";
import { characterSchema } from "@archivist/dnd5e/pc/pc.schema";

describe("characterSchema — draft (class-less) tolerance", () => {
  const draft = {
    name: "Untitled",
    edition: "2014" as const,
    class: [],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual" as const,
    state: { hp: { current: 0, max: 0, temp: 0 } },
  };

  it("accepts an empty class array (a build-in-progress draft)", () => {
    const result = characterSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it("still defaults class to [] when the key is omitted", () => {
    const { class: _omit, ...noClass } = draft;
    const result = characterSchema.safeParse(noClass);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.class).toEqual([]);
  });

  it("accepts the builder:true draft marker and keeps it on parse", () => {
    const result = characterSchema.safeParse({ ...draft, builder: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.builder).toBe(true);
  });

  it("leaves builder absent (no default) when the key is omitted", () => {
    const result = characterSchema.safeParse(draft);
    expect(result.success).toBe(true);
    // No default: a finished/legacy file never gains a builder key on parse.
    if (result.success) expect(result.data.builder).toBeUndefined();
  });

  it("accepts a persisted builder_rolls pool and keeps it on parse", () => {
    const result = characterSchema.safeParse({ ...draft, ability_method: "rolled", builder_rolls: [15, 14, 13, 12, 10, 8] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.builder_rolls).toEqual([15, 14, 13, 12, 10, 8]);
  });

  it("leaves builder_rolls absent (no default) when omitted — existing files don't gain it", () => {
    const result = characterSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.builder_rolls).toBeUndefined();
  });
});
