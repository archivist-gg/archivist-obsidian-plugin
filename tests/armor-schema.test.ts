import { describe, it, expect } from "vitest";
import * as yaml from "js-yaml";
import { armorEntitySchema } from "../src/modules/armor/armor.schema";
import {
  PLATE,
  BREASTPLATE,
  LEATHER,
  SHIELD,
  MAGE_ARMOR,
  UNARMORED_DEFENSE_MONK,
  UNARMORED_DEFENSE_BARBARIAN,
} from "./fixtures/armor";

function parse(src: string) {
  const data = yaml.load(src.trim());
  return armorEntitySchema.safeParse(data);
}

describe("armorEntitySchema", () => {
  it("validates heavy armor with strength requirement and stealth disadvantage", () => {
    const r = parse(PLATE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.category).toBe("heavy");
      expect(r.data.ac.base).toBe(18);
      expect(r.data.ac.add_dex).toBe(false);
      expect(r.data.strength_requirement).toBe(15);
      expect(r.data.stealth_disadvantage).toBe(true);
    }
  });

  it("validates medium armor with capped DEX", () => {
    const r = parse(BREASTPLATE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ac.add_dex).toBe(true);
      expect(r.data.ac.dex_max).toBe(2);
    }
  });

  it("validates light armor with uncapped DEX", () => {
    const r = parse(LEATHER);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ac.add_dex).toBe(true);
      expect(r.data.ac.dex_max).toBeUndefined();
    }
  });

  it("validates a shield", () => {
    const r = parse(SHIELD);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.category).toBe("shield");
      expect(r.data.ac.base).toBe(0);
      expect(r.data.ac.flat).toBe(2);
    }
  });

  it("validates spell-derived armor (Mage Armor)", () => {
    const r = parse(MAGE_ARMOR);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.category).toBe("spell");
  });

  it("validates Monk Unarmored Defense (DEX + WIS)", () => {
    const r = parse(UNARMORED_DEFENSE_MONK);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ac.add_dex).toBe(true);
      expect(r.data.ac.add_wis).toBe(true);
      expect(r.data.ac.add_con).toBe(false);
    }
  });

  it("validates Barbarian Unarmored Defense (DEX + CON)", () => {
    const r = parse(UNARMORED_DEFENSE_BARBARIAN);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ac.add_con).toBe(true);
      expect(r.data.ac.add_wis).toBe(false);
    }
  });

  it("rejects entries missing ac.base", () => {
    const bad = `name: Bad\nslug: bad\ncategory: heavy\nac: { flat: 0, add_dex: false, add_con: false, add_wis: false }`;
    expect(parse(bad).success).toBe(false);
  });

  it("preserves unknown top-level fields via passthrough", () => {
    const src = `name: Plate\nslug: plate\ncategory: heavy\nac: { base: 18, flat: 0, add_dex: false, add_con: false, add_wis: false }\nweird_homebrew_field: 42`;
    const r = parse(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).weird_homebrew_field).toBe(42);
    }
  });
});
