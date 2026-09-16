/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { MarkdownRenderer } from "obsidian";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import {
  renderBackgroundTables,
  renderSuggestedCharacteristics,
  descriptionEmbedsTable,
  tablesNotInDescription,
  type BgTable,
} from "../packages/obsidian/src/shared/rendering/background-tables";

beforeAll(() => installObsidianDomHelpers());
// A case that fails BEFORE its own `spy.mockRestore()` would otherwise leak the
// spy into the rest of the file (vi.spyOn on an already-spied method hands back
// the SAME spy, calls and all), which turns one mutant kill into a cascade of
// unrelated ones. Measured under the M-41a mutant, 2026-09-04.
afterEach(() => { vi.restoreAllMocks(); });

/** The corpus shape (R4-G3b §10.1): 2 tables, 8 rows each, `roll` a STRING on
 *  every row; the only non-integer roll in the whole corpus is "2-3". */
const TABLES = [
  { name: "Origin", dice: "d8", rows: Array.from({ length: 8 }, (_, i) => ({ roll: String(i + 1), text: `Origin ${i + 1}` })) },
  { name: "Specialty", dice: "d8", rows: [{ roll: "1", text: "Blackmailer" }, ...Array.from({ length: 6 }, (_, i) => ({ roll: String(i + 2), text: `S${i + 2}` })), { roll: "2-3", text: "Ranged" }] },
];

describe("renderBackgroundTables (R4-G3b §10)", () => {
  it("renders one table per entry with the dice and name as headers, one row per entry, rolls verbatim", () => {
    const c = mountContainer();
    renderBackgroundTables(c, TABLES);
    const tables = c.querySelectorAll("table");
    // RED FIRST before Task 11 (df04139a): the module did not exist, so the
    // import failed and every case in this file errored before its first expect.
    expect(tables).toHaveLength(2);
    expect(c.querySelectorAll("tbody tr")).toHaveLength(16);
    expect(Array.from(tables[0].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d8", "Origin"]);
    expect(Array.from(c.querySelectorAll("tbody tr td:first-child")).map((t) => t.textContent)).toContain("2-3");
  });

  it("routes every row's text through the shared markdown path (the spy sees the <td> parent and the decorated text)", () => {
    // The spy CALLS THROUGH (a bare vi.spyOn, never mockImplementation); the
    // obsidian mock's `render` is SYNCHRONOUS and sets textContent, so the
    // call-count assertion needs no flush (Gate 1 A C8; Gate 2 M7).
    const spy = vi.spyOn(MarkdownRenderer, "render");
    const c = mountContainer();
    renderBackgroundTables(c, [TABLES[0]]);
    // RED FIRST before Task 11 (df04139a): no module, no call.
    expect(spy).toHaveBeenCalledTimes(8);
    expect(spy.mock.calls[0][1]).toBe("Origin 1");
    expect((spy.mock.calls[0][2] as HTMLElement).tagName).toBe("TD");
    spy.mockRestore();
  });

  it("an empty/absent tables array renders no table", () => {
    const c = mountContainer();
    renderBackgroundTables(c, []);
    expect(c.querySelector("table")).toBeNull();
  });
});

describe("renderSuggestedCharacteristics", () => {
  it("the table arm: a 6-key record renders 6 rows under d6, in NUMERIC key order (12 keys: '2' before '10')", () => {
    const c = mountContainer();
    renderSuggestedCharacteristics(c, {
      bonds: { "1": "a", "2": "b", "3": "c", "4": "d", "5": "e", "6": "f" },
      flaws: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), `f${i + 1}`])),
    });
    const tables = c.querySelectorAll("table");
    // RED FIRST before Task 11 (df04139a): no module.
    expect(Array.from(tables[0].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d6", "Bonds"]);
    // The 12-key fixture pins a NUMERIC sort: under a LEXICOGRAPHIC one
    // (`keys.sort().map(Number)`) this row reads ["1", "10", "11"]. Measured
    // 2026-09-04: dropping the sort entirely is NOT observable here, because V8
    // enumerates canonical integer-index keys in ascending numeric order however
    // they were inserted (evidence/g3b-t11-m43a.txt); the 6-key record sorts
    // identically either way, which is why the 12-key one exists.
    expect(Array.from(tables[1].querySelectorAll("tbody tr td:first-child")).map((t) => t.textContent).slice(0, 3)).toEqual(["1", "2", "3"]);
  });

  it("the table arm reads the AUTHORED key: a non-canonical roll key renders instead of throwing", () => {
    const c = mountContainer();
    // "01" passes the /^\d+$/ table-arm test but is not the string `String(Number("01"))`
    // produces, so the old builder looked up `record["1"]`, got undefined, and
    // `cellText` threw on `.name`. Ordering is still NUMERIC: "01" (1) before "2"
    // before "10". V8 enumerates this record as ["2", "10", "01"] · the two
    // canonical integer indices first, the rest in insertion order · so the sort
    // is doing real work here.
    renderSuggestedCharacteristics(c, { bonds: { "01": "a", "2": "b", "10": "c" } });
    // RED FIRST before the final wave (e1ef541): this case never reached an
    // expect · `cellText(record["1"])` threw `TypeError: Cannot read properties
    // of undefined (reading 'name')`.
    expect(Array.from(c.querySelectorAll("tbody tr td:first-child")).map((t) => t.textContent))
      .toEqual(["01", "2", "10"]);
    expect(Array.from(c.querySelectorAll("tbody tr td:last-child")).map((t) => t.textContent))
      .toEqual(["a", "b", "c"]);
    expect(Array.from(c.querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d3", "Bonds"]);
  });

  it("the ideals composer: name. desc (alignment)", () => {
    // Bare spy, calls through (see above).
    const spy = vi.spyOn(MarkdownRenderer, "render");
    const c = mountContainer();
    renderSuggestedCharacteristics(c, { ideals: { "1": { name: "Tradition", desc: "Uphold.", alignment: "Lawful" }, "2": { desc: "Help." } } });
    // RED FIRST before Task 11 (df04139a): no module. Also RED under String(ideal).
    expect(spy.mock.calls.map((k) => k[1])).toEqual(["Tradition. Uphold. (Lawful)", "Help."]);
    spy.mockRestore();
  });

  it("the prose arm: a non-numeric key hands the joined, CRLF-normalised text to the markdown path and builds NO table", () => {
    // Bare spy, calls through (see above).
    const spy = vi.spyOn(MarkdownRenderer, "render");
    const c = mountContainer();
    renderSuggestedCharacteristics(c, { personality_traits: { _open5e_prose: "Intro\r\n\r\n| d8 | Trait |\r\n|---|---|\r\n| 1 | x |" } });
    // RED FIRST before Task 11 (df04139a): no module.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toBe("Intro\n\n| d8 | Trait |\n|---|---|\n| 1 | x |");
    // The helper builds none: the mock renders text, the real renderer builds the
    // pipe tables (and tags them `.archivist-table` on the way out).
    expect(c.querySelector("table")).toBeNull();
    spy.mockRestore();
  });

  it("null / absent renders nothing", () => {
    const c = mountContainer();
    renderSuggestedCharacteristics(c, null);
    expect(c.childElementCount).toBe(0);
  });
});

// R4-G3b Task 15 (rider): the converter emits BOTH representations of a roll
// table · a markdown pipe table inside `description` and the structured
// `tables:` key · so the NOTE rendered 84 of the corpus's 88 tables twice.
// These two pure helpers are the dedupe. The note path filters through them
// from Task 15; the builder step joined it in Task 15c (the describe below).
describe("descriptionEmbedsTable / tablesNotInDescription (R4-G3b Task 15)", () => {
  const SCAM: BgTable = {
    name: "Scam",
    dice: "d6",
    rows: [{ roll: "1", text: "I cheat at games of chance." }, { roll: "2", text: "I shave coins." }],
  };
  /** The real Charlatan shape: prose, the pipe table, more prose. */
  const CHARLATAN_DESC = [
    "You have always had a way with people.",
    "",
    "| d6 | Scam |",
    "| --- | --- |",
    "| 1 | I cheat at games of chance. |",
    "| 2 | I shave coins. |",
    "",
    "You have a knack for reading people.",
  ].join("\n");

  it("the header arm: a pipe line whose first two cells are the table's dice and name", () => {
    expect(descriptionEmbedsTable(CHARLATAN_DESC, SCAM)).toBe(true);
  });

  it("the row arm: the header is spelled differently but the first row is present verbatim", () => {
    const desc = CHARLATAN_DESC.replace("| d6 | Scam |", "| d6 | Scams and cons |");
    // The header arm cannot fire here ("scams and cons" is not "scam"), so a TRUE
    // is the row arm and nothing else.
    expect(descriptionEmbedsTable(desc, SCAM)).toBe(true);
  });

  it("the Rakdos shape: the description embeds the two Contact tables, so only Type of Performer survives the filter", () => {
    // Measured on the shipped GGtR Rakdos Cultist: the description carries
    // `d8 | Contact` and `d10 | Contact`, while `d8 | Type of Performer` appears
    // in `tables:` only (its first row "Spikewheel acrobat" is nowhere in the
    // description). Both embedded tables carry a roll-1 row, so the row arm is
    // live on this fixture too.
    const desc = [
      "Rakdos Cultist prose.",
      "",
      "| d8 | Contact |",
      "| --- | --- |",
      "| 1 | A guildmaster who owes you a favour. |",
      "",
      "| d10 | Contact |",
      "| --- | --- |",
      "| 1 | A rival performer you admire. |",
    ].join("\n");
    const performer: BgTable = { name: "Type of Performer", dice: "d8", rows: [{ roll: "1", text: "Spikewheel acrobat" }] };
    const contact8: BgTable = { name: "Contact", dice: "d8", rows: [{ roll: "1", text: "A guildmaster who owes you a favour." }] };
    const contact10: BgTable = { name: "Contact", dice: "d10", rows: [{ roll: "1", text: "A rival performer you admire." }] };
    expect(tablesNotInDescription([performer, contact8, contact10], desc)).toEqual([performer]);
  });

  it("a description with no pipe table keeps every table, in a FRESH array, leaving the input untouched", () => {
    const input = [SCAM, { name: "Contact", dice: "d10", rows: [{ roll: "1", text: "A fence." }] }];
    const out = tablesNotInDescription(input, "You have always had a way with people.");
    expect(out).toHaveLength(2);
    expect(out).not.toBe(input);
    expect(input).toHaveLength(2);
  });

  it("a separator block and an unrelated table header match nothing, a dice-less and name-less table included", () => {
    const desc = ["| --- | --- |", "", "| Spell Level | Spells |", "| --- | --- |", "| 1st | Bless |"].join("\n");
    expect(descriptionEmbedsTable(desc, SCAM)).toBe(false);
    // A separator normalises to EMPTY cells, and empty-celled lines are dropped
    // before any arm sees them · so even a degenerate table cannot match one.
    expect(descriptionEmbedsTable(desc, { name: "", dice: "", rows: [] })).toBe(false);
  });

  it("the row arm compares a PREFIX of the first row's text, not the roll alone", () => {
    // A description whose only pipe rows share the roll "1" with the table but
    // carry different text. This is the case an empty prefix would flip TRUE.
    const desc = ["| d20 | Other |", "| --- | --- |", "| 1 | Unrelated row text |"].join("\n");
    expect(descriptionEmbedsTable(desc, SCAM)).toBe(false);
  });

  it("case and punctuation insensitivity: `| D6 | scam: |` matches dice d6 name Scam", () => {
    expect(descriptionEmbedsTable("| D6 | scam: |", SCAM)).toBe(true);
  });

  it("an absent description, and a table with no rows, fall to the header arm only", () => {
    expect(descriptionEmbedsTable(null, SCAM)).toBe(false);
    expect(descriptionEmbedsTable(undefined, SCAM)).toBe(false);
    const rowless: BgTable = { name: "Scam", dice: "d6", rows: [] };
    expect(descriptionEmbedsTable(CHARLATAN_DESC, rowless)).toBe(true);
    expect(descriptionEmbedsTable("| 1 | I cheat at games of chance. |", rowless)).toBe(false);
    expect(tablesNotInDescription(undefined, CHARLATAN_DESC)).toEqual([]);
  });
});

// R4-G3b Task 15c (rider, second arm): 4 of the corpus's 88 roll tables are
// embedded in `feature.description` rather than in `description` (Astral Drifter,
// GGtR Dimir Operative, GGtR Rakdos Cultist, SCAG Inheritor). Both surfaces render
// the feature description through the markdown path, so both showed those tables
// twice. The filter therefore takes ANY number of descriptions and drops a table
// that ANY of them embeds; the note hands it both, the step only the feature one.
describe("tablesNotInDescription over several descriptions (R4-G3b Task 15c)", () => {
  const PERFORMER: BgTable = { name: "Type of Performer", dice: "d8", rows: [{ roll: "1", text: "Spikewheel acrobat" }] };
  const CONTACT8: BgTable = { name: "Contact", dice: "d8", rows: [{ roll: "1", text: "A guildmaster who owes you a favour." }] };
  const CONTACT10: BgTable = { name: "Contact", dice: "d10", rows: [{ roll: "1", text: "A rival performer you admire." }] };
  /** The shipped Rakdos Cultist shape: the two Contact tables live in `description`. */
  const DESC = [
    "Rakdos Cultist prose.",
    "",
    "| d8 | Contact |",
    "| --- | --- |",
    "| 1 | A guildmaster who owes you a favour. |",
    "",
    "| d10 | Contact |",
    "| --- | --- |",
    "| 1 | A rival performer you admire. |",
  ].join("\n");
  /** ... while `d8 | Type of Performer` lives in the FEATURE's description only. */
  const FEATURE_DESC = [
    "As a member of the Rakdos, you have a role in the show.",
    "",
    "| d8 | Type of Performer |",
    "| --- | --- |",
    "| 1 | Spikewheel acrobat |",
  ].join("\n");

  it("a table embedded only in the SECOND description is dropped; a table embedded in neither survives", () => {
    // RED FIRST at 27875c5d: the filter took ONE description, so at runtime the
    // extra argument was ignored and Type of Performer survived beside Contact.
    expect(tablesNotInDescription([PERFORMER, CONTACT10], "Prose with no pipe table.", FEATURE_DESC)).toEqual([CONTACT10]);
    // A null or undefined extra argument is ignored, never treated as a match.
    expect(tablesNotInDescription([PERFORMER, CONTACT10], "Prose with no pipe table.", null)).toEqual([PERFORMER, CONTACT10]);
    expect(tablesNotInDescription([PERFORMER, CONTACT10], "Prose with no pipe table.", undefined)).toEqual([PERFORMER, CONTACT10]);
  });

  it("the Rakdos shape: over both descriptions nothing survives; over the description alone Type of Performer does", () => {
    // RED FIRST at 27875c5d: the feature arm did not exist, so this read
    // [PERFORMER]. The second assertion is the Task 15 regression pin: the
    // one-description call keeps its exact old meaning.
    expect(tablesNotInDescription([PERFORMER, CONTACT8, CONTACT10], DESC, FEATURE_DESC)).toEqual([]);
    expect(tablesNotInDescription([PERFORMER, CONTACT8, CONTACT10], DESC)).toEqual([PERFORMER]);
  });
});
