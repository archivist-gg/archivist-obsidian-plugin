import { describe, it, expect } from "vitest";
import { parseWeapon } from "../src/modules/weapon/weapon.parser";
import { LONGSWORD, DAGGER, LONGBOW, NET, LANCE } from "./fixtures/weapon";

describe("parseWeapon — canonical YAML", () => {
  it("parses Longsword", () => {
    const r = parseWeapon(LONGSWORD);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.damage.versatile_dice).toBe("1d10");
  });

  it("parses Lance with conditional property", () => {
    const r = parseWeapon(LANCE);
    expect(r.success).toBe(true);
    if (r.success) {
      const cond = r.data.properties.find((p) => typeof p === "object");
      expect(cond).toBeTruthy();
    }
  });

  it("parses Net (damage-less)", () => {
    const r = parseWeapon(NET);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.damage.dice).toBe("0");
    }
  });
});

describe("parseWeapon — semi-structured property strings", () => {
  it("lifts versatile (1d10) into damage.versatile_dice", () => {
    const src = `
name: Longsword
slug: longsword
category: martial-melee
damage: { dice: 1d8, type: slashing }
properties: ["versatile (1d10)"]
edition: "2014"
`;
    const r = parseWeapon(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.damage.versatile_dice).toBe("1d10");
      expect(r.data.properties).toContain("versatile");
    }
  });

  it("lifts thrown (range 20/60) into range", () => {
    const src = `
name: Dagger
slug: dagger
category: simple-melee
damage: { dice: 1d4, type: piercing }
properties: [finesse, light, "thrown (range 20/60)"]
edition: "2014"
`;
    const r = parseWeapon(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.range).toEqual({ normal: 20, long: 60 });
      expect(r.data.properties).toContain("thrown");
    }
  });

  it("lifts ammunition (range 150/600) into range", () => {
    const src = `
name: Longbow
slug: longbow
category: martial-ranged
damage: { dice: 1d8, type: piercing }
properties: ["ammunition (range 150/600)", "heavy", "two_handed"]
edition: "2014"
`;
    const r = parseWeapon(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.range).toEqual({ normal: 150, long: 600 });
      expect(r.data.properties).toContain("ammunition");
    }
  });

  it("preserves unrecognized property strings under raw.unparsed_properties", () => {
    const src = `
name: Weird Weapon
slug: weird-weapon
category: martial-melee
damage: { dice: 1d6, type: slashing }
properties: [light, "weird homebrew (foo bar)"]
edition: "2014"
`;
    const r = parseWeapon(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.properties).toContain("light");
      expect(r.data.raw?.unparsed_properties).toEqual(["weird homebrew (foo bar)"]);
    }
  });
});

describe("parseWeapon — error paths", () => {
  it("rejects missing required fields", () => {
    expect(parseWeapon(`name: x`).success).toBe(false);
  });
});
