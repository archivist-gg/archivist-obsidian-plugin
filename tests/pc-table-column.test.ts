import { describe, it, expect } from "vitest";
import { readTableColumn } from "../src/modules/pc/pc.table-column";

const table = {
  2: { columns: { "Interdict Boons": 1, "Cantrips": "2" } },
  7: { columns: { "Interdict Boons": 3 } },
};

describe("readTableColumn", () => {
  it("reads a numeric column at a level", () => {
    expect(readTableColumn(table, 7, ["Interdict Boons"])).toBe(3);
  });
  it("parses a string-numeric column", () => {
    expect(readTableColumn(table, 2, ["Cantrips"])).toBe(2);
  });
  it("tries keys in order and returns the first hit", () => {
    expect(readTableColumn(table, 2, ["Missing", "Interdict Boons"])).toBe(1);
  });
  it("returns null when the level/column is absent", () => {
    expect(readTableColumn(table, 5, ["Interdict Boons"])).toBeNull();
    expect(readTableColumn(undefined, 2, ["x"])).toBeNull();
  });
});
