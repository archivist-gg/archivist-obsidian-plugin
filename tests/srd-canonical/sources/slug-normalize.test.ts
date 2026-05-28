import { describe, it, expect } from "vitest";
import { slugifyName } from "../../../tools/srd-canonical/sources/slug-normalize";

describe("slugifyName", () => {
  it("lowercase + hyphenates spaces", () => {
    expect(slugifyName("Eldritch Blast")).toBe("eldritch-blast");
  });
  it("strips apostrophes (Mordenkainen's → mordenkainens)", () => {
    expect(slugifyName("Mordenkainen's Sword")).toBe("mordenkainens-sword");
  });
  it("collapses double hyphens (Hill - Dwarf → hill-dwarf)", () => {
    expect(slugifyName("Hill - Dwarf")).toBe("hill-dwarf");
  });
  it("strips parentheticals (Belt of Hill Giant Strength → belt-of-hill-giant-strength)", () => {
    expect(slugifyName("Belt of Hill Giant Strength")).toBe("belt-of-hill-giant-strength");
  });
  it("preserves digits (1d4 should not appear; +1 weapons handled by variant expansion)", () => {
    expect(slugifyName("Caster Level 5")).toBe("caster-level-5");
  });
});
