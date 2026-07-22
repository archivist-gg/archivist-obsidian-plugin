import { describe, it, expect } from "vitest";
import {
  COIN_KEYS, COIN_META, MAX_COIN, totalCp, formatGpTotal, validateAdjust, assembleDeltas,
} from "../packages/obsidian/src/modules/pc/pc.coin-math";

describe("COIN_KEYS / COIN_META", () => {
  it("orders PP→CP and names all five with correct hints (gp has none)", () => {
    expect(COIN_KEYS).toEqual(["pp", "gp", "ep", "sp", "cp"]);
    expect(COIN_META.pp).toEqual({ name: "Platinum", hint: "1 pp = 10 gp" });
    expect(COIN_META.gp).toEqual({ name: "Gold", hint: null });
    expect(COIN_META.ep).toEqual({ name: "Electrum", hint: "1 gp = 2 ep" });
    expect(COIN_META.sp).toEqual({ name: "Silver", hint: "1 gp = 10 sp" });
    expect(COIN_META.cp).toEqual({ name: "Copper", hint: "1 gp = 100 cp" });
  });
});

describe("totalCp", () => {
  it("weights pp·1000 + gp·100 + ep·50 + sp·10 + cp", () => {
    expect(totalCp({ pp: 2, gp: 148, ep: 4, sp: 23, cp: 57 })).toBe(2000 + 14800 + 200 + 230 + 57);
  });
  it("treats missing keys, undefined, and null as 0", () => {
    expect(totalCp({ gp: 1 })).toBe(100);
    expect(totalCp(undefined)).toBe(0);
    expect(totalCp(null)).toBe(0);
    expect(totalCp({})).toBe(0);
  });
});

describe("formatGpTotal", () => {
  it("formats whole gp without decimals", () => {
    expect(formatGpTotal(17000)).toBe("170");
    expect(formatGpTotal(0)).toBe("0");
  });
  it("trims a trailing zero to one decimal", () => {
    expect(formatGpTotal(17050)).toBe("170.5");
  });
  it("keeps two decimals when needed, padding sub-10 copper", () => {
    expect(formatGpTotal(17287)).toBe("172.87");
    expect(formatGpTotal(10007)).toBe("100.07");
  });
});

describe("validateAdjust", () => {
  it("accepts in-bounds adds and subtracts", () => {
    expect(validateAdjust({ gp: 10, sp: 5 }, { gp: 5, sp: -5 })).toEqual({ ok: true, offending: [] });
  });
  it("flags every coin that would go below 0 (atomic)", () => {
    const r = validateAdjust({ gp: 10, sp: 3 }, { gp: -11, sp: -4, cp: 2 });
    expect(r.ok).toBe(false);
    expect(r.offending).toEqual(["gp", "sp"]);
  });
  it("flags overflow past MAX_COIN", () => {
    const r = validateAdjust({ gp: MAX_COIN }, { gp: 1 });
    expect(r).toEqual({ ok: false, offending: ["gp"] });
  });
  it("treats absent currency as zeros", () => {
    expect(validateAdjust(undefined, { gp: -1 })).toEqual({ ok: false, offending: ["gp"] });
    expect(validateAdjust(undefined, { gp: 1 })).toEqual({ ok: true, offending: [] });
  });
});

describe("assembleDeltas", () => {
  it("parses digits base-10, permits leading zeros, applies the sign", () => {
    expect(assembleDeltas({ gp: "007", sp: "5" }, 1)).toEqual({ gp: 7, sp: 5 });
    expect(assembleDeltas({ gp: "37" }, -1)).toEqual({ gp: -37 });
  });
  it("ignores empty boxes and boxes parsing to 0 — they are never offending", () => {
    expect(assembleDeltas({ pp: "", gp: "0", ep: "00", sp: "  ", cp: "1" }, 1)).toEqual({ cp: 1 });
  });
  it("returns {} when nothing yields a non-zero delta (caller no-op)", () => {
    expect(assembleDeltas({ gp: "0", sp: "" }, 1)).toEqual({});
    expect(assembleDeltas({}, -1)).toEqual({});
  });
});
