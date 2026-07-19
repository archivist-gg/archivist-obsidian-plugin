import { describe, it, expect, vi } from "vitest";
import {
  addItem, removeItem, equipItem, unequipItem, attuneItem, unattuneItem,
  identifyItem, consumeScroll, setCharges, setCurrency, type EquipResult, type AttuneResult,
} from "../packages/obsidian/src/modules/pc/pc.equipment-edit";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

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

  // FIX 1: a two-handed weapon can only occupy the mainhand. When the mainhand
  // is held by a 1H weapon it must surface a conflict (NOT silently route to
  // offhand), and equipping a shield while a 2H weapon is held conflicts on it.
  it("two-handed weapon while mainhand occupied → conflict on mainhand (not routed to offhand)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[longsword]]", equipped: true, slot: "mainhand" }, { item: "[[greatsword]]" }];
    const r = equipItem(c, 1, reg);
    expect(r.kind).toBe("conflict");
    if (r.kind === "conflict") expect(r.slot).toBe("mainhand");
    expect(c.equipment[1].equipped).toBeFalsy();
    expect(c.equipment[1].slot).toBeUndefined();
  });

  it("shield while a two-handed weapon holds the mainhand → conflict on the 2H weapon", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[greatsword]]", equipped: true, slot: "mainhand" }, { item: "[[shield]]" }];
    const r = equipItem(c, 1, reg);
    expect(r.kind).toBe("conflict");
    if (r.kind === "conflict") {
      expect(r.withIndex).toBe(0);
      expect(r.slot).toBe("mainhand");
    }
    expect(c.equipment[1].equipped).toBeFalsy();
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

// P4 Task 4: identify (normalizing replace): the fresh entry is inherently
// valid (unequipped/unattuned/slotless), so no occupant to invalidate and no
// re-validation needed. All per-instance state is dropped.
describe("identifyItem", () => {
  it("replaces the entry and resets per-instance state", () => {
    const c = baseChar();
    c.equipment = [{
      item: "[[me_unidentified-weapon]]",
      equipped: true,
      attuned: true,
      slot: "mainhand",
      qty: 3,
      overrides: { resist: ["fire"] },
      state: { charges: { current: 1, max: 1 } },
      notes: "mystery",
      granted_by: "builder:starting",
    }];
    identifyItem(c, 0, "srd-2024_ring-of-protection");
    const e = c.equipment[0];
    expect(e.item).toBe("[[srd-2024_ring-of-protection]]");
    expect(e.equipped).toBe(false);
    expect(e.attuned).toBe(false);
    expect(e.slot ?? null).toBeNull();
    expect(e.qty).toBe(1);
    expect(e.overrides ?? undefined).toBeUndefined();
    expect(e.state ?? undefined).toBeUndefined();
    expect(e.notes ?? undefined).toBeUndefined();
    expect(e.granted_by ?? undefined).toBeUndefined();
  });

  it("does not throw on an out-of-range index", () => {
    const c = baseChar();
    expect(() => identifyItem(c, 7, "srd_x")).not.toThrow();
    expect(c.equipment).toHaveLength(0);
  });
});

// P4 Task 6: casting a scroll CONSUMES the item. Each cast decrements the
// stack quantity; the last charge removes the entry entirely (a spent scroll
// leaves the inventory).
describe("consumeScroll", () => {
  it("decrements qty when more than one remains", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[spell-scroll-fireball]]", qty: 2 }];
    consumeScroll(c, 0);
    expect(c.equipment).toHaveLength(1);
    expect(c.equipment[0].qty).toBe(1);
  });

  it("removes the entry when the last one is consumed (qty 1)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[spell-scroll-fireball]]", qty: 1 }];
    consumeScroll(c, 0);
    expect(c.equipment).toHaveLength(0);
  });

  it("treats a missing qty as 1 and removes the entry", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[spell-scroll-fireball]]" }];
    consumeScroll(c, 0);
    expect(c.equipment).toHaveLength(0);
  });

  it("does not throw on an out-of-range index", () => {
    const c = baseChar();
    expect(() => consumeScroll(c, 7)).not.toThrow();
    expect(c.equipment).toHaveLength(0);
  });

  it("only touches the targeted entry when several are present", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[a]]" }, { item: "[[spell-scroll-fireball]]", qty: 2 }, { item: "[[c]]" }];
    consumeScroll(c, 1);
    expect(c.equipment.map((e) => e.item)).toEqual(["[[a]]", "[[spell-scroll-fireball]]", "[[c]]"]);
    expect(c.equipment[1].qty).toBe(1);
  });
});

describe("CharacterEditState.consumeScroll wrapper", () => {
  it("delegates to the mutator and fires onChange once", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[spell-scroll-fireball]]", qty: 2 }];
    const onChange = vi.fn();
    const es = new CharacterEditState(
      c,
      () => ({ resolved: {} as never, derived: {} as never }),
      onChange,
      reg,
    );
    es.consumeScroll(0);
    expect(c.equipment[0].qty).toBe(1);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("CharacterEditState.identifyItem wrapper", () => {
  it("delegates to the mutator and fires onChange once", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[me_unidentified]]", equipped: true, attuned: true, slot: "mainhand" }];
    const onChange = vi.fn();
    const es = new CharacterEditState(
      c,
      () => ({ resolved: {} as never, derived: {} as never }),
      onChange,
      reg,
    );
    es.identifyItem(0, "srd-2024_ring-of-protection");
    expect(c.equipment[0].item).toBe("[[srd-2024_ring-of-protection]]");
    expect(c.equipment[0].equipped).toBe(false);
    expect(c.equipment[0].attuned).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("equipItem write-path parity (A1)", () => {
  it("routes magic armor (base_item) to the armor slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[adamantine-breastplate]]", equipped: false }];
    const r = equipItem(c, 0, reg);
    expect(r.kind).toBe("ok");
    expect(c.equipment[0].slot).toBe("armor");
  });

  it("routes a category:'heavy' Shield to the shield slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[heavy-shield]]", equipped: false }];
    equipItem(c, 0, reg);
    expect(c.equipment[0].slot).toBe("shield");
  });

  it("resolves a vault-path wikilink to write the armor slot", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[SRD 2024/Armor/Breastplate]]", equipped: false }];
    equipItem(c, 0, reg);
    expect(c.equipment[0].slot).toBe("armor");
  });
});
