import { describe, it, expect } from "vitest";
import { plainText } from "../packages/obsidian/src/shared/rendering/plain-text";

describe("plainText", () => {
  it.each([
    ["While *Bloodied*", "While Bloodied"],
    ["while you aren't wearing armor or wielding a [[Player's Handbook (2024)/Magic Items/Shield|Shield]]", "while you aren't wearing armor or wielding a Shield"],
    ["[[Player's Handbook (2014)/Conditions/Paralyzed]]", "Paralyzed"],
    ["`d:1d8` + your Constitution modifier", "d:1d8 + your Constitution modifier"],
    ["_emphasis_ and plain", "emphasis and plain"],
  ])("%s → %s", (input, want) => expect(plainText(input)).toBe(want));
});
