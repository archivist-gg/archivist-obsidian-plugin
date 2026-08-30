import { describe, it, expect } from "vitest";
import {
  humanizeSlug,
  humanizeToken,
  fixedNamesFrom,
  grantLabel,
  fixedGrantLines,
} from "../packages/obsidian/src/shared/rendering/renderer-utils";

describe("humanizeSlug", () => {
  it("capitalizes hyphen tokens without touching apostrophes", () => {
    expect(humanizeSlug("sleight-of-hand")).toBe("Sleight Of Hand");
    expect(humanizeSlug("calligrapher's-supplies")).toBe("Calligrapher's Supplies");
  });
});

// R4-P3b §12: the one implementation behind what used to be four twin helpers
// (`fixedToolNames` and `fixedLanguageNames`/`languageSummary`, once each in the
// builder background step and the passive Background block).
describe("fixedNamesFrom", () => {
  it("humanizes the fixed entries' names for the requested field, flattened in order", () => {
    expect(fixedNamesFrom([{ kind: "fixed", items: ["calligrapher's-supplies"] }], "items"))
      .toEqual(["Calligrapher's Supplies"]);
    expect(fixedNamesFrom(
      [{ kind: "fixed", languages: ["common"] }, { kind: "fixed", languages: ["deep-speech", "elvish"] }],
      "languages",
    )).toEqual(["Common", "Deep Speech", "Elvish"]);
  });

  it("skips choice entries: a background's tool/language CHOICE lives in choices[], not here", () => {
    expect(fixedNamesFrom([{ kind: "choice" }], "languages")).toEqual([]);
    expect(fixedNamesFrom(
      [{ kind: "choice" }, { kind: "fixed", languages: ["common"] }],
      "languages",
    )).toEqual(["Common"]);
    // An entry with no `kind` at all is not fixed either.
    expect(fixedNamesFrom([{ languages: ["common"] }], "languages")).toEqual([]);
  });

  it("returns [] for undefined and for an empty array", () => {
    expect(fixedNamesFrom(undefined, "items")).toEqual([]);
    expect(fixedNamesFrom([], "languages")).toEqual([]);
  });

  // TWIN RECONCILIATION. The two tool twins guarded `items` with `?? []`; the two
  // language twins read `l.languages` bare and threw on a fixed entry missing the
  // array (reachable, since entity data is parsed YAML cast to the type). The
  // guarded form won for BOTH fields, so a malformed entry contributes no names
  // instead of taking down the whole background render.
  it("a fixed entry whose array is missing contributes nothing and does not throw", () => {
    expect(fixedNamesFrom([{ kind: "fixed" }], "languages")).toEqual([]);
    expect(fixedNamesFrom([{ kind: "fixed" }], "items")).toEqual([]);
    expect(fixedNamesFrom(
      [{ kind: "fixed" }, { kind: "fixed", languages: ["common"] }],
      "languages",
    )).toEqual(["Common"]);
  });

  // The requested field is read exclusively: a tool entry never leaks into the
  // Languages row, which is what keeps the two call sites from crossing over.
  it("reads only the requested field", () => {
    expect(fixedNamesFrom([{ kind: "fixed", items: ["gaming-set"] }], "languages")).toEqual([]);
    expect(fixedNamesFrom([{ kind: "fixed", languages: ["common"] }], "items")).toEqual([]);
  });
});

describe("humanizeToken", () => {
  it("underscores", () => expect(humanizeToken("two_handed")).toBe("Two Handed"));
  it("hyphens", () => expect(humanizeToken("martial-melee")).toBe("Martial Melee"));
  it("parens", () => expect(humanizeToken("special_(net)")).toBe("Special (Net)"));
  it("apostrophe-safe", () => expect(humanizeToken("hunter's-mark")).toBe("Hunter's Mark"));
  it("slash intentionally not capitalized", () => expect(humanizeToken("enlarge/reduce")).toBe("Enlarge/reduce"));
});

describe("grantLabel / fixedGrantLines (R4-G1a D5, G9)", () => {
  it("prefers display_name after gold and before category/item", () => {
    expect(grantLabel({ gold: 5 })).toBe("5 GP");
    expect(grantLabel({ item: "holy-symbol", display_name: "holy symbol (a gift to you when you entered the priesthood)" })).toBe("holy symbol (a gift to you when you entered the priesthood)");
    expect(grantLabel({ item: "book", display_name: "prayer book", qty: 2 })).toBe("prayer book \u00d72");
    expect(grantLabel({ category: "gaming-set", display_name: "gaming set matching your chosen proficiency" })).toBe("gaming set matching your chosen proficiency");
    // Deviation (recorded): the brief spelled this "a martial weapon". `grantLabel`'s category
    // spelling is `a ${humanizeSlug(...)}`, which title-cases; the expectation is the MEASURED
    // string, so no surface's text changes.
    expect(grantLabel({ category: "martial-weapon" })).toBe("a Martial Weapon");
  });
  it("fixedGrantLines: label short-circuits; grants join with a comma; missing grants degrade to an empty string", () => {
    expect(fixedGrantLines({ label: "Robe", grants: [{ item: "robe" }] })).toBe("Robe");
    // Deviation (recorded): the brief spelled the first grant "pouch"; the undecorated item arm
    // humanizes the slug, so the measured join is "Pouch, holy symbol".
    expect(fixedGrantLines({ grants: [{ item: "pouch", contains_value: 1500 }, { item: "holy-symbol", display_name: "holy symbol" }] })).toBe("Pouch, holy symbol");
    expect(fixedGrantLines({} as { grants?: unknown })).toBe("");
  });
});
