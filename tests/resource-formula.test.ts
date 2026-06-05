import { describe, it, expect } from "vitest";
import { isValidMaxFormula, evaluateMaxFormula, type FormulaBindings }
  from "../src/shared/dnd/resource-formula";

const ctx: FormulaBindings = {
  level: 5, class_level: 5, prof: 3,
  str_mod: 1, dex_mod: 2, con_mod: 3, int_mod: 0, wis_mod: 1, cha_mod: 4,
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
