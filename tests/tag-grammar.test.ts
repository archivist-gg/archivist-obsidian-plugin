import { describe, it, expect } from "vitest";
import { parseTagTerms, normalizeTagType } from "../src/shared/dnd/tag-grammar";

describe("normalizeTagType", () => {
  it("maps canonical and alias forms", () => {
    expect(normalizeTagType("atk")).toBe("atk");
    expect(normalizeTagType("attack")).toBe("atk");
    expect(normalizeTagType("dmg")).toBe("dmg");
    expect(normalizeTagType("damage")).toBe("dmg");
    expect(normalizeTagType("dc")).toBe("dc");
    expect(normalizeTagType("dice")).toBe("dice");
    expect(normalizeTagType("ATK")).toBe("atk");
  });

  it("returns null for unknown forms", () => {
    expect(normalizeTagType("foo")).toBeNull();
  });
});

describe("parseTagTerms", () => {
  it("parses a single ability", () => {
    const r = parseTagTerms("STR");
    expect(r).toEqual({ abilityTerm: "str", pbTerm: false, literalTerms: [], diceTerms: [] });
  });

  it("parses ability + PB", () => {
    const r = parseTagTerms("STR+PB");
    expect(r).toEqual({ abilityTerm: "str", pbTerm: true, literalTerms: [], diceTerms: [] });
  });

  it("parses signed literal", () => {
    expect(parseTagTerms("+5")).toEqual({ pbTerm: false, literalTerms: [5], diceTerms: [] });
    expect(parseTagTerms("-2")).toEqual({ pbTerm: false, literalTerms: [-2], diceTerms: [] });
  });

  it("parses dice + ability + literal", () => {
    const r = parseTagTerms("1d8+STR+2");
    expect(r).toEqual({
      abilityTerm: "str",
      pbTerm: false,
      literalTerms: [2],
      diceTerms: [{ count: 1, sides: 8 }],
    });
  });

  it("parses dice + ability + PB + literal", () => {
    const r = parseTagTerms("1d8+STR+PB+2");
    expect(r).toEqual({
      abilityTerm: "str",
      pbTerm: true,
      literalTerms: [2],
      diceTerms: [{ count: 1, sides: 8 }],
    });
  });

  it("rejects empty content", () => {
    expect(parseTagTerms("")).toEqual({ error: "empty content" });
  });

  it("rejects multiple ability terms", () => {
    const r = parseTagTerms("STR+DEX");
    expect(r).toHaveProperty("error");
  });

  it("rejects unrecognized terms", () => {
    expect(parseTagTerms("STR+FOO")).toHaveProperty("error");
  });
});
