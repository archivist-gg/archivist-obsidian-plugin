import { describe, it, expect } from "vitest";
import { parseItem } from "../src/modules/item/item.parser";

describe("parseItem — legacy backward compatibility", () => {
  it("parses prose-only magic item (existing compendium shape)", () => {
    const src = `
name: Goggles of Night
type: Wondrous item
rarity: uncommon
attunement: false
entries:
  - "While wearing these dark lenses, you have darkvision out to a range of 60 feet."
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Goggles of Night");
      expect(r.data.attunement).toEqual({ required: false });
    }
  });

  it("auto-promotes string attunement to canonical shape", () => {
    const src = `
name: Cloak Test
attunement: "by a wizard"
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attunement).toEqual({ required: true, restriction: "by a wizard" });
    }
  });

  it("auto-promotes boolean true attunement to canonical shape", () => {
    const src = `name: Cloak Test\nattunement: true`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attunement).toEqual({ required: true });
    }
  });
});

describe("parseItem — new structured fields", () => {
  it("parses bonuses block (Cloak of Protection-style)", () => {
    const src = `
name: Cloak of Protection
type: Wondrous item
rarity: uncommon
attunement: { required: true }
bonuses:
  ac: 1
  saving_throws: 1
entries: ["You gain a +1 bonus to AC and saving throws while you wear this cloak."]
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bonuses?.ac).toBe(1);
      expect(r.data.bonuses?.saving_throws).toBe(1);
    }
  });

  it("parses charges + recharge + attached_spells (Wand of Magic Missiles-style)", () => {
    const src = `
name: Wand of Magic Missiles
rarity: uncommon
charges:
  max: 7
  recharge: dawn
  recharge_amount: "1d6+1"
attached_spells:
  charges:
    "1": [magic-missile]
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.charges?.max).toBe(7);
      expect(r.data.charges?.recharge).toBe("dawn");
      expect(r.data.attached_spells?.charges?.["1"]).toEqual(["magic-missile"]);
    }
  });

  it("parses attached_spells.limited (Necklace of Fireballs-style)", () => {
    const src = `
name: Necklace of Fireballs
rarity: rare
attached_spells:
  limited:
    "9": [fireball]
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attached_spells?.limited?.["9"]).toEqual(["fireball"]);
    }
  });

  it("parses attunement with class restriction tags", () => {
    const src = `
name: Holy Avenger
attunement:
  required: true
  restriction: "by a paladin"
  tags:
    - { class: paladin }
bonuses:
  weapon_attack: 3
  weapon_damage: 3
base_item: longsword
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.base_item).toBe("longsword");
      const att = r.data.attunement;
      expect(typeof att === "object" && !Array.isArray(att) && att !== null && (att as { tags?: unknown[] }).tags?.[0]).toEqual({ class: "paladin" });
    }
  });

  it("parses immune array and grants", () => {
    const src = `
name: Efreeti Chain
bonuses: { ac: 3 }
immune: [fire]
grants:
  languages: [primordial]
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.immune).toEqual(["fire"]);
      expect(r.data.grants?.languages).toEqual(["primordial"]);
    }
  });

  it("parses container fields (Bag of Holding-style)", () => {
    const src = `
name: Bag of Holding
container:
  capacity_weight: 500
  weightless: true
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.container?.capacity_weight).toBe(500);
      expect(r.data.container?.weightless).toBe(true);
    }
  });

  it("parses sentient/focus/tier flags", () => {
    const src = `
name: Test Item
sentient: true
focus: arcane
tier: major
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sentient).toBe(true);
      expect(r.data.focus).toBe("arcane");
      expect(r.data.tier).toBe("major");
    }
  });
});

describe("parseItem — raw escape hatch", () => {
  it("preserves unknown top-level fields under raw", () => {
    const src = `
name: Weird Item
weird_field: 42
nested_thing:
  foo: bar
`;
    const r = parseItem(src);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.raw?.weird_field).toBe(42);
      expect(r.data.raw?.nested_thing).toEqual({ foo: "bar" });
    }
  });
});
