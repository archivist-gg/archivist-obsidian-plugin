import { describe, it, expect } from "vitest";
import { plainText } from "../packages/obsidian/src/shared/rendering/plain-text";

describe("plainText", () => {
  it.each([
    ["While *Bloodied*", "While Bloodied"],
    ["while you aren't wearing armor or wielding a [[Player's Handbook (2024)/Magic Items/Shield|Shield]]", "while you aren't wearing armor or wielding a Shield"],
    ["[[Player's Handbook (2014)/Conditions/Paralyzed]]", "Paralyzed"],
    ["`d:1d8` + your Constitution modifier", "d:1d8 + your Constitution modifier"],
    ["_emphasis_ and plain", "emphasis and plain"],
    // Double markers, and the nested case. Pre-fix these were HALF-eaten (measured:
    // "**Bloodied**" came out "*Bloodied*", "__strong__" came out "_strong_",
    // "While ***very*** bold" came out "While **very** bold"), because the single-marker
    // passes ran with no double-marker pass before them. Every value below is measured.
    ["**Bloodied**", "Bloodied"],
    ["__strong__", "strong"],
    ["While ***very*** bold", "While very bold"],
    // The bound on the underscore pass. Unbounded, this read "a savingthrowbonus field" ·
    // a qualifier quoting a field name was silently corrupted. `*` needs no such guard,
    // so the two markers are deliberately NOT symmetrical.
    ["a saving_throw_bonus field", "a saving_throw_bonus field"],
  ])("%s → %s", (input, want) => expect(plainText(input)).toBe(want));

  // The docblock claims unpaired and non-emphasis markers pass through as authored. These are
  // that claim, not decoration: they are what separates "bounded" from "greedy enough to work
  // on the happy path". Each value was measured against the shipped passes.
  it.each([
    ["a_b", "a_b"],
    ["snake_case_only", "snake_case_only"],
    ["_leading only", "_leading only"],
    ["_", "_"],
  ])("passes %s through untouched", (input, want) => expect(plainText(input)).toBe(want));

  it("strips emphasis inside parentheses and before punctuation (the bound's own edges)", () => {
    expect(plainText("(_nested_) parens")).toBe("(nested) parens");
    expect(plainText("trailing _emph_.")).toBe("trailing emph.");
    expect(plainText("*a* _b_ **c**")).toBe("a b c");
  });
});
