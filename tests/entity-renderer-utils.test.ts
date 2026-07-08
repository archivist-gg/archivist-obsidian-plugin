import { describe, it, expect } from "vitest";
import { humanizeSlug } from "../packages/obsidian/src/shared/rendering/renderer-utils";

describe("humanizeSlug", () => {
  it("capitalizes hyphen tokens without touching apostrophes", () => {
    expect(humanizeSlug("sleight-of-hand")).toBe("Sleight Of Hand");
    expect(humanizeSlug("calligrapher's-supplies")).toBe("Calligrapher's Supplies");
  });
});
