import { describe, it, expect } from "vitest";
import { characterSchema } from "../src/modules/pc/pc.schema";

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
});
