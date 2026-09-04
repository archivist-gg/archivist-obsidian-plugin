/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { MarkdownRenderer } from "obsidian";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import {
  renderBackgroundTables,
  renderSuggestedCharacteristics,
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
