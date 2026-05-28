// tests/tag-autocomplete.test.ts

import { describe, it, expect } from "vitest";
import { buildTagOptions } from "../src/shared/edit/tag-autocomplete";

describe("buildTagOptions", () => {
  const abilities = { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 };
  const profBonus = 3;
  // STR mod = +3, DEX = +2, CON = +1, INT = 0, WIS = +1, CHA = -1

  it("suggests both atk:K (no PB) and atk:K+PB forms for each ability", () => {
    const opts = buildTagOptions(abilities, profBonus);
    expect(opts.some((s) => s.tag === "atk:STR")).toBe(true);
    expect(opts.some((s) => s.tag === "atk:STR+PB")).toBe(true);
    expect(opts.some((s) => s.tag === "atk:DEX")).toBe(true);
    expect(opts.some((s) => s.tag === "atk:DEX+PB")).toBe(true);
  });

  it("suggests dc:K but never dc:K+PB", () => {
    const opts = buildTagOptions(abilities, profBonus);
    expect(opts.some((s) => s.tag === "dc:WIS")).toBe(true);
    expect(opts.some((s) => s.tag === "dc:WIS+PB")).toBe(false);
  });

  it("preview for atk:STR is +3, atk:STR+PB is +6", () => {
    const opts = buildTagOptions(abilities, profBonus);
    const noPb = opts.find((s) => s.tag === "atk:STR");
    const withPb = opts.find((s) => s.tag === "atk:STR+PB");
    expect(noPb?.preview).toBe("+3");
    expect(withPb?.preview).toBe("+6");
  });

  it("preview for dc:WIS is DC 12 (8 + PB + WIS mod = 8 + 3 + 1)", () => {
    const opts = buildTagOptions(abilities, profBonus);
    const dc = opts.find((s) => s.tag === "dc:WIS");
    expect(dc?.preview).toBe("DC 12");
  });
});
