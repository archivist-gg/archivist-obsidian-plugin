import { describe, it, expect } from "vitest";
import { castTimeCategory, rangeCategory } from "../src/modules/pc/components/spells/spell-filter";

describe("castTimeCategory", () => {
  it("maps the standard tokens", () => {
    expect(castTimeCategory("action")).toBe("action");
    expect(castTimeCategory("bonus-action")).toBe("bonus");
    expect(castTimeCategory("reaction")).toBe("reaction");
    expect(castTimeCategory("1minute")).toBe("long");
    expect(castTimeCategory("10minutes")).toBe("long");
    expect(castTimeCategory("1hour")).toBe("long");
    expect(castTimeCategory(undefined)).toBe("special");
    expect(castTimeCategory("weird")).toBe("special");
  });
});

describe("rangeCategory", () => {
  it("buckets the range string", () => {
    expect(rangeCategory("Self")).toBe("self");
    expect(rangeCategory("Self (15-foot cone)")).toBe("self");
    expect(rangeCategory("Touch")).toBe("touch");
    expect(rangeCategory("120 feet")).toBe("ranged");
    expect(rangeCategory("60 ft")).toBe("ranged");
    expect(rangeCategory("1 mile")).toBe("special");
    expect(rangeCategory("Sight")).toBe("special");
    expect(rangeCategory(undefined)).toBe("special");
  });
});
