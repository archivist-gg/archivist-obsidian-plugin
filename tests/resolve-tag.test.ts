// tests/resolve-tag.test.ts

import { describe, it, expect, vi } from "vitest";
import { resolveTag } from "../src/shared/dnd/formula-tags";

const CTX = {
  abilities: { str: 16, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  proficiencyBonus: 3,
};
// STR mod = +3, DEX = +2, CON = +1, INT = 0, WIS = +1, CHA = -1
// PB = 3

describe("resolveTag — atk", () => {
  it("atk:STR resolves to STR mod alone", () => {
    const r = resolveTag("atk", "STR", CTX);
    expect(r.display).toBe("+3");
    expect(r.value).toBe(3);
    expect(r.rollable).toBe(true);
  });

  it("atk:STR+PB resolves to STR + PB", () => {
    const r = resolveTag("atk", "STR+PB", CTX);
    expect(r.display).toBe("+6");
    expect(r.value).toBe(6);
  });

  it("atk:DEX+PB+1 resolves to DEX + PB + 1 (magic weapon)", () => {
    const r = resolveTag("atk", "DEX+PB+1", CTX);
    expect(r.display).toBe("+6");
  });

  it("atk:+5 resolves to literal", () => {
    const r = resolveTag("atk", "+5", CTX);
    expect(r.display).toBe("+5");
    expect(r.value).toBe(5);
  });

  it("atk:CHA resolves to negative ability mod alone", () => {
    const r = resolveTag("atk", "CHA", CTX);
    expect(r.display).toBe("-1");
  });
});

describe("resolveTag — dc", () => {
  it("dc:WIS resolves to 8 + PB + WIS mod (PB always implicit)", () => {
    const r = resolveTag("dc", "WIS", CTX);
    expect(r.display).toBe("DC 12");
    expect(r.value).toBe(12);
  });

  it("dc:15 resolves to literal", () => {
    const r = resolveTag("dc", "15", CTX);
    expect(r.display).toBe("DC 15");
  });

  it("dc:CHA+2 resolves to 8 + PB + CHA + 2", () => {
    const r = resolveTag("dc", "CHA+2", CTX);
    expect(r.display).toBe("DC 12");
  });

  it("dc:WIS+PB rejected with warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = resolveTag("dc", "WIS+PB", CTX);
    expect(r.display).toBe("WIS+PB");
    expect(r.rollable).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("resolveTag — dmg", () => {
  it("dmg:1d8+STR resolves to dice + ability mod", () => {
    const r = resolveTag("dmg", "1d8+STR", CTX);
    expect(r.display).toBe("1d8+3");
    expect(r.rollable).toBe(true);
  });

  it("dmg:2d6 resolves to dice only", () => {
    const r = resolveTag("dmg", "2d6", CTX);
    expect(r.display).toBe("2d6");
  });

  it("dmg:1d8+STR+2 resolves with bonus", () => {
    const r = resolveTag("dmg", "1d8+STR+2", CTX);
    expect(r.display).toBe("1d8+5");
  });

  it("dmg:1d8+PB rejected", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = resolveTag("dmg", "1d8+PB", CTX);
    expect(r.display).toBe("1d8+PB");
    warn.mockRestore();
  });
});

describe("resolveTag — alias normalization", () => {
  it("'attack' alias works as 'atk'", () => {
    const r = resolveTag("attack", "STR", CTX);
    expect(r.display).toBe("+3");
  });

  it("'damage' alias works as 'dmg'", () => {
    const r = resolveTag("damage", "1d8", CTX);
    expect(r.display).toBe("1d8");
  });

  it("case-insensitive", () => {
    expect(resolveTag("ATK", "STR", CTX).display).toBe("+3");
  });
});

describe("resolveTag — error fallback", () => {
  it("malformed content returns content as display", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = resolveTag("atk", "STR+FOO", CTX);
    expect(r.display).toBe("STR+FOO");
    expect(r.rollable).toBe(false);
    warn.mockRestore();
  });

  it("unknown tagType returns content unchanged", () => {
    const r = resolveTag("foo", "STR", CTX);
    expect(r.display).toBe("STR");
  });
});
