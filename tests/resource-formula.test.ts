import { describe, it, expect } from "vitest";
import { isValidMaxFormula, evaluateMaxFormula, resolveMaxAt, type FormulaBindings }
  from "@archivist-gg/dnd5e/dnd/resource-formula";

const ctx: FormulaBindings = {
  level: 5, class_level: 5, prof: 3,
  str_mod: 1, dex_mod: 2, con_mod: 3, int_mod: 0, wis_mod: 1, cha_mod: 4,
  columns: {},
};

describe("isValidMaxFormula", () => {
  it("accepts the supported grammar", () => {
    for (const f of ["2", "level", "class_level", "5 * level", "{cha_mod}",
                     "1 + {cha_mod}", "prof", "prof * 2", "999"]) {
      expect(isValidMaxFormula(f)).toBe(true);
    }
  });
  it("rejects unknown tokens and bad syntax", () => {
    for (const f of ["", "wizardry", "{foo_mod}", "level /", "2 ** 3", "level level"]) {
      expect(isValidMaxFormula(f)).toBe(false);
    }
  });
});

describe("evaluateMaxFormula", () => {
  it("evaluates against bindings", () => {
    expect(evaluateMaxFormula("2", ctx)).toBe(2);
    expect(evaluateMaxFormula("level", ctx)).toBe(5);
    expect(evaluateMaxFormula("5 * level", ctx)).toBe(25);
    expect(evaluateMaxFormula("{cha_mod}", ctx)).toBe(4);
    expect(evaluateMaxFormula("1 + {cha_mod}", ctx)).toBe(5);
    expect(evaluateMaxFormula("prof * 2", ctx)).toBe(6);
  });
});

describe("isValidMaxFormula whitespace + precedence", () => {
  it("accepts surrounding whitespace", () => {
    expect(isValidMaxFormula("level ")).toBe(true);
    expect(isValidMaxFormula("  1 + {cha_mod}  ")).toBe(true);
  });
});

describe("evaluateMaxFormula precedence and edges", () => {
  it("multiplication binds tighter than addition", () => {
    expect(evaluateMaxFormula("1 + 2 * 3", ctx)).toBe(7);
    expect(evaluateMaxFormula("2 * 3 + 1", ctx)).toBe(7);
  });
  it("subtraction is left-associative and may go negative", () => {
    expect(evaluateMaxFormula("10 - 3 - 2", ctx)).toBe(5);
    expect(evaluateMaxFormula("1 - 5", ctx)).toBe(-4);
  });
  it("tolerates trailing whitespace", () => {
    expect(evaluateMaxFormula("2 ", ctx)).toBe(2);
  });
});

describe("DSL extension — division, ceil/floor, parens", () => {
  it("real division then ceil/floor", () => {
    expect(evaluateMaxFormula("ceil({class_level}/2)", ctx)).toBe(3);   // ceil(5/2)
    expect(evaluateMaxFormula("floor({class_level}/2)", ctx)).toBe(2);  // floor(5/2)
    expect(evaluateMaxFormula("level / 2", ctx)).toBe(2.5);
  });
  it("parentheses group", () => {
    expect(evaluateMaxFormula("(1 + level) * 2", ctx)).toBe(12);
  });
  it("validates the new grammar", () => {
    for (const f of ["ceil({class_level}/2)", "floor(level/3)", "(level + 1) * prof", "level / 2"]) {
      expect(isValidMaxFormula(f)).toBe(true);
    }
  });
  it("still rejects malformed input", () => {
    for (const f of ["level /", "ceil(", "ceil()", "floor level", "( 1 + 2"]) {
      expect(isValidMaxFormula(f)).toBe(false);
    }
  });
});

describe("column() accessor", () => {
  const ctxCols: FormulaBindings = {
    level: 5, class_level: 5, prof: 3,
    str_mod: 1, dex_mod: 2, con_mod: 3, int_mod: 0, wis_mod: 1, cha_mod: 4,
    columns: { Seals: 4, "Seal Damage": 8 },
  };
  it("evaluates a column by name", () => {
    expect(evaluateMaxFormula("column('Seals')", ctxCols)).toBe(4);
  });
  it("handles column names with spaces", () => {
    expect(evaluateMaxFormula("column('Seal Damage')", ctxCols)).toBe(8);
  });
  it("unknown column resolves to 0", () => {
    expect(evaluateMaxFormula("column('Nope')", ctxCols)).toBe(0);
  });
  it("composes with arithmetic", () => {
    expect(evaluateMaxFormula("column('Seals') + 1", ctxCols)).toBe(5);
    expect(evaluateMaxFormula("column('Seals') * prof", ctxCols)).toBe(12);
  });
  it("validates column() permissively (any name via the ZERO map)", () => {
    expect(isValidMaxFormula("column('Seals')")).toBe(true);
    expect(isValidMaxFormula("column('Anything At All')")).toBe(true);
    expect(isValidMaxFormula("column('Seals') * 2")).toBe(true);
  });
  it("rejects malformed column usage and bare string literals", () => {
    expect(isValidMaxFormula("'Seals'")).toBe(false);     // string only valid inside column()
    expect(isValidMaxFormula("column(Seals)")).toBe(false); // arg must be quoted
    expect(isValidMaxFormula("column()")).toBe(false);      // arg required
    expect(isValidMaxFormula("column('a'")).toBe(false);    // unbalanced
  });
  it("present-but-zero column evaluates to 0 (indistinguishable from missing, by design)", () => {
    expect(evaluateMaxFormula("column('Z')", { ...ctxCols, columns: { Z: 0 } })).toBe(0);
  });
});

describe("resolveMaxAt", () => {
  const rage = { max_formula: "2", scales_at: [
    { level: 3, max: "3" }, { level: 6, max: "4" }, { level: 12, max: "5" },
    { level: 17, max: "6" }, { level: 20, max: "999" },
  ] };
  it("returns base below the first step", () => {
    expect(resolveMaxAt(1, rage)).toBe("2");
    expect(resolveMaxAt(2, rage)).toBe("2");
  });
  it("returns the highest applicable step", () => {
    expect(resolveMaxAt(3, rage)).toBe("3");
    expect(resolveMaxAt(11, rage)).toBe("4");
    expect(resolveMaxAt(20, rage)).toBe("999");
  });
  it("returns base when there are no steps", () => {
    expect(resolveMaxAt(10, { max_formula: "level" })).toBe("level");
  });
});
