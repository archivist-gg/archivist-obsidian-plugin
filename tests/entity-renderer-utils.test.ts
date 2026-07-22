import { describe, it, expect } from "vitest";
import { humanizeSlug, humanizeToken } from "../packages/obsidian/src/shared/rendering/renderer-utils";

describe("humanizeSlug", () => {
  it("capitalizes hyphen tokens without touching apostrophes", () => {
    expect(humanizeSlug("sleight-of-hand")).toBe("Sleight Of Hand");
    expect(humanizeSlug("calligrapher's-supplies")).toBe("Calligrapher's Supplies");
  });
});

describe("humanizeToken", () => {
  it("underscores", () => expect(humanizeToken("two_handed")).toBe("Two Handed"));
  it("hyphens", () => expect(humanizeToken("martial-melee")).toBe("Martial Melee"));
  it("parens", () => expect(humanizeToken("special_(net)")).toBe("Special (Net)"));
  it("apostrophe-safe", () => expect(humanizeToken("hunter's-mark")).toBe("Hunter's Mark"));
  it("slash intentionally not capitalized", () => expect(humanizeToken("enlarge/reduce")).toBe("Enlarge/reduce"));
});
