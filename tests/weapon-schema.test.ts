import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { weaponEntitySchema } from "../src/modules/weapon/weapon.schema";
import { LONGSWORD, DAGGER, LONGBOW, NET, LANCE } from "./fixtures/weapon";

function parse(src: string) {
  return weaponEntitySchema.safeParse(yaml.load(src.trim()));
}

describe("weaponEntitySchema", () => {
  it("validates Longsword (versatile)", () => {
    const r = parse(LONGSWORD);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.damage.versatile_dice).toBe("1d10");
      expect(r.data.properties).toContain("versatile");
    }
  });

  it("validates Dagger (finesse + thrown with range)", () => {
    const r = parse(DAGGER);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.properties).toContain("finesse");
      expect(r.data.range).toEqual({ normal: 20, long: 60 });
    }
  });

  it("validates Longbow (ammunition + heavy + two-handed)", () => {
    const r = parse(LONGBOW);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.range).toEqual({ normal: 150, long: 600 });
      expect(r.data.ammo_type).toBe("arrow");
    }
  });

  it("validates Net (damage-less)", () => {
    const r = parse(NET);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.damage.dice).toBe("0");
      expect(r.data.damage.type).toBe("");
    }
  });

  it("validates Lance (conditional property object)", () => {
    const r = parse(LANCE);
    expect(r.success).toBe(true);
    if (r.success) {
      const conditional = r.data.properties.find(
        (p) => typeof p === "object" && p.kind === "conditional",
      );
      expect(conditional).toBeDefined();
      if (typeof conditional === "object") {
        expect(conditional.uid).toBe("two_handed");
        expect(conditional.note).toBe("unless mounted");
      }
    }
  });

  it("rejects entries missing damage", () => {
    expect(parse(`name: x\nslug: x\ncategory: simple-melee`).success).toBe(false);
  });
});
