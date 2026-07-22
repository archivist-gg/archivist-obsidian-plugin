import { describe, it, expect } from "vitest";
import { adjustCurrency, setCurrency } from "../packages/obsidian/src/modules/pc/pc.equipment-edit";
import { MAX_COIN } from "../packages/obsidian/src/modules/pc/pc.coin-math";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

function makeCharacter(currency?: Character["currency"]): Character {
  return { currency } as unknown as Character;
}

describe("adjustCurrency (pure, atomic multi-coin)", () => {
  it("initializes currency to five zeros when absent, then applies deltas", () => {
    const c = makeCharacter(undefined);
    adjustCurrency(c, { gp: 5 });
    expect(c.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 });
  });
  it("applies several coins in one call (add and subtract mixed)", () => {
    const c = makeCharacter({ cp: 10, sp: 10, ep: 0, gp: 10, pp: 0 });
    adjustCurrency(c, { gp: 37, sp: -5, cp: -10 });
    expect(c.currency).toEqual({ cp: 0, sp: 5, ep: 0, gp: 47, pp: 0 });
  });
  it("truncates fractional deltas toward zero", () => {
    const c = makeCharacter({ cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 });
    adjustCurrency(c, { gp: 2.9 });
    expect(c.currency!.gp).toBe(12);
    adjustCurrency(c, { gp: -2.9 });
    expect(c.currency!.gp).toBe(10);
  });
  it("defensively clamps to [0, MAX_COIN] (UI pre-validates; this is belt-and-braces)", () => {
    const c = makeCharacter({ cp: 0, sp: 0, ep: 0, gp: 3, pp: MAX_COIN });
    adjustCurrency(c, { gp: -5, pp: 10 });
    expect(c.currency!.gp).toBe(0);
    expect(c.currency!.pp).toBe(MAX_COIN);
  });
  it("leaves coins without a delta untouched", () => {
    const c = makeCharacter({ cp: 1, sp: 2, ep: 3, gp: 4, pp: 5 });
    adjustCurrency(c, { gp: 1 });
    expect(c.currency).toEqual({ cp: 1, sp: 2, ep: 3, gp: 5, pp: 5 });
  });
});

describe("setCurrency (existing behavior locked)", () => {
  it("still floors and clamps at 0", () => {
    const c = makeCharacter(undefined);
    setCurrency(c, "gp", 12.7);
    expect(c.currency!.gp).toBe(12);
    setCurrency(c, "gp", -4);
    expect(c.currency!.gp).toBe(0);
  });
});
