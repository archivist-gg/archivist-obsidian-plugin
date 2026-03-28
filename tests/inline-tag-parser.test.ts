import { describe, it, expect } from "vitest";
import { parseInlineTag } from "../src/parsers/inline-tag-parser";

describe("parseInlineTag", () => {
  it("parses a dice tag", () => {
    const tag = parseInlineTag("dice: 2d6+3");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("dice");
    expect(tag!.content).toBe("2d6+3");
  });

  it("parses a damage tag", () => {
    const tag = parseInlineTag("damage: 3d8 fire");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("damage");
    expect(tag!.content).toBe("3d8 fire");
  });

  it("parses a dc tag", () => {
    const tag = parseInlineTag("dc: 15 Wisdom");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("dc");
    expect(tag!.content).toBe("15 Wisdom");
  });

  it("parses an atk tag", () => {
    const tag = parseInlineTag("atk: +7 to hit");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("atk");
    expect(tag!.content).toBe("+7 to hit");
  });

  it("parses a mod tag", () => {
    const tag = parseInlineTag("mod: +5");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("mod");
    expect(tag!.content).toBe("+5");
  });

  it("parses a check tag", () => {
    const tag = parseInlineTag("check: Perception");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("check");
    expect(tag!.content).toBe("Perception");
  });

  it("returns null for unknown prefix", () => {
    const tag = parseInlineTag("foo: bar");
    expect(tag).toBeNull();
  });

  it("returns null for plain code (no colon)", () => {
    const tag = parseInlineTag("just some text");
    expect(tag).toBeNull();
  });

  it("handles whitespace around prefix and content", () => {
    const tag = parseInlineTag("  dice :  4d6  ");
    expect(tag).not.toBeNull();
    expect(tag!.type).toBe("dice");
    expect(tag!.content).toBe("4d6");
  });
});
