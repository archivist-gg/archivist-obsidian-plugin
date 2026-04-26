import { describe, it, expect } from "vitest";
import {
  addItem, removeItem, equipItem, unequipItem, attuneItem, unattuneItem,
  setCharges, setCurrency, type EquipResult, type AttuneResult,
} from "../src/modules/pc/pc.equipment-edit";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import type { Character } from "../src/modules/pc/pc.types";

const reg = buildEquipmentRegistry();

const baseChar = (): Character => ({
  name: "T", edition: "2014", race: null, subrace: null, background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
});

describe("addItem", () => {
  it("appends a new entry with defaults", () => {
    const c = baseChar();
    addItem(c, "longsword", {});
    expect(c.equipment).toHaveLength(1);
    expect(c.equipment[0]).toMatchObject({ item: "[[longsword]]", equipped: false });
  });

  it("respects equipped + slot opts", () => {
    const c = baseChar();
    addItem(c, "longsword", { equipped: true, slot: "offhand" }, reg);
    expect(c.equipment[0]).toMatchObject({ equipped: true, slot: "offhand" });
  });
});

describe("removeItem", () => {
  it("splices the entry; preserves order", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[a]]" }, { item: "[[b]]" }, { item: "[[c]]" }];
    removeItem(c, 1);
    expect(c.equipment.map((e) => e.item)).toEqual(["[[a]]", "[[c]]"]);
  });
});

describe("equipItem", () => {
  it("sets equipped + assigns default slot", () => {
    const c = baseChar();
    addItem(c, "longsword", {});
    const r = equipItem(c, 0, reg) as EquipResult;
    expect(r.kind).toBe("ok");
    expect(c.equipment[0].equipped).toBe(true);
    expect(c.equipment[0].slot).toBe("mainhand");
  });

  it("returns conflict when armor slot occupied (no mutation)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[plate]]", equipped: true, slot: "armor" }, { item: "[[studded-leather]]" }];
    const r = equipItem(c, 1, reg);
    expect(r.kind).toBe("conflict");
    if (r.kind === "conflict") expect(r.withIndex).toBe(0);
    expect(c.equipment[1].equipped).toBeFalsy();
  });

  it("two-handed weapon + equipped shield → conflict on shield", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[shield]]", equipped: true, slot: "shield" }, { item: "[[greatsword]]" }];
    const r = equipItem(c, 1, reg);
    expect(r.kind).toBe("conflict");
  });
});

describe("attuneItem", () => {
  it("sets attuned: true under the limit", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true }];
    const r = attuneItem(c, 0, reg) as AttuneResult;
    expect(r.kind).toBe("ok");
    expect(c.equipment[0].attuned).toBe(true);
  });

  it("rejects past limit", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
      { item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true },
      { item: "[[headband-of-intellect]]", equipped: true, attuned: true },
      { item: "[[flame-tongue]]", equipped: true, attuned: false },
    ];
    const r = attuneItem(c, 3, reg);
    expect(r.kind).toBe("rejected");
    expect(c.equipment[3].attuned).toBeFalsy();
  });

  it("respects overrides.attunement_limit", () => {
    const c = baseChar();
    c.overrides = { attunement_limit: 4 };
    c.equipment = [
      { item: "[[cloak-of-protection]]", equipped: true, attuned: true },
      { item: "[[belt-of-hill-giant-strength]]", equipped: true, attuned: true },
      { item: "[[headband-of-intellect]]", equipped: true, attuned: true },
      { item: "[[flame-tongue]]", equipped: true, attuned: false },
    ];
    const r = attuneItem(c, 3, reg);
    expect(r.kind).toBe("ok");
    expect(c.equipment[3].attuned).toBe(true);
  });
});

describe("setCharges", () => {
  it("clamps current to [0, max]", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[wand]]", state: { charges: { current: 5, max: 7 } } }];
    setCharges(c, 0, 99);
    expect(c.equipment[0].state!.charges!.current).toBe(7);
    setCharges(c, 0, -3);
    expect(c.equipment[0].state!.charges!.current).toBe(0);
  });

  it("can update max as well", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[wand]]", state: { charges: { current: 5, max: 7 } } }];
    setCharges(c, 0, 5, 10);
    expect(c.equipment[0].state!.charges!.max).toBe(10);
  });
});

describe("setCurrency", () => {
  it("creates currency object on first set", () => {
    const c = baseChar();
    setCurrency(c, "gp", 100);
    expect(c.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 });
  });

  it("clamps to 0", () => {
    const c = baseChar();
    setCurrency(c, "gp", -5);
    expect(c.currency!.gp).toBe(0);
  });
});

describe("unattuneItem", () => {
  it("clears attuned flag", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: true, attuned: true }];
    unattuneItem(c, 0);
    expect(c.equipment[0].attuned).toBe(false);
  });
});
