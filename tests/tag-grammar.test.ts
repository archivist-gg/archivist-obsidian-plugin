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
    expect(r).toEqual({ abilityTerm: "str", pbTerm: false, literalTerms: [], diceTerms: [], slugTerms: [] });
  });

  it("parses ability + PB", () => {
    const r = parseTagTerms("STR+PB");
    expect(r).toEqual({ abilityTerm: "str", pbTerm: true, literalTerms: [], diceTerms: [], slugTerms: [] });
  });

  it("parses signed literal", () => {
    expect(parseTagTerms("+5")).toEqual({ pbTerm: false, literalTerms: [5], diceTerms: [], slugTerms: [] });
    expect(parseTagTerms("-2")).toEqual({ pbTerm: false, literalTerms: [-2], diceTerms: [], slugTerms: [] });
  });

  it("parses dice + ability + literal", () => {
    const r = parseTagTerms("1d8+STR+2");
    expect(r).toEqual({
      abilityTerm: "str",
      pbTerm: false,
      literalTerms: [2],
      diceTerms: [{ count: 1, sides: 8 }],
      slugTerms: [],
    });
  });

  it("parses dice + ability + PB + literal", () => {
    const r = parseTagTerms("1d8+STR+PB+2");
    expect(r).toEqual({
      abilityTerm: "str",
      pbTerm: true,
      literalTerms: [2],
      diceTerms: [{ count: 1, sides: 8 }],
      slugTerms: [],
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

describe("parseTagTerms — slug terms", () => {
  it("parses [[longsword]] alongside ability + PB", () => {
    const r = parseTagTerms("STR+PB+[[longsword]]");
    if ("error" in r) throw new Error(r.error);
    expect(r.abilityTerm).toBe("str");
    expect(r.pbTerm).toBe(true);
    expect(r.slugTerms).toEqual(["longsword"]);
  });

  it("parses multiple slug terms", () => {
    const r = parseTagTerms("DEX+[[longsword]]+[[blessing]]");
    if ("error" in r) throw new Error(r.error);
    expect(r.slugTerms).toEqual(["longsword", "blessing"]);
  });

  it("parses hyphenated slug bodies without splitting on internal '-'", () => {
    const r = parseTagTerms("STR+PB+[[plus-one-longsword]]");
    if ("error" in r) throw new Error(r.error);
    expect(r.abilityTerm).toBe("str");
    expect(r.pbTerm).toBe(true);
    expect(r.slugTerms).toEqual(["plus-one-longsword"]);
  });

  it("rejects malformed slug ([[ unbalanced)", () => {
    const r = parseTagTerms("STR+[[longsword");
    expect("error" in r).toBe(true);
  });

  it("preserves backward compatibility — no slug, no slugTerms or empty", () => {
    const r = parseTagTerms("STR+PB");
    if ("error" in r) throw new Error(r.error);
    expect(r.slugTerms ?? []).toEqual([]);
  });
});
