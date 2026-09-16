import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

const reg = buildEquipmentRegistry();
const baseChar = (): Character => ({
  name: "T",
  edition: "2014",
  race: null,
  subrace: null,
  background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: {
    hp: { current: 10, max: 10, temp: 0 },
    hit_dice: {},
    spell_slots: {},
    concentration: null,
    conditions: [],
    inspiration: 0,
    exhaustion: 0,
  },
});

function mkState(c: Character) {
  const onChange = vi.fn();
  const es = new CharacterEditState(
    c,
    () => ({
      resolved: {
        definition: c,
        race: null,
        classes: [],
        background: null,
        feats: [],
        totalLevel: 1,
        features: [],
        spells: [],
        state: c.state,
      },
      derived: {} as never,
    }),
    onChange,
    reg,
  );
  return { es, onChange };
}

describe("CharacterEditState equipment delegators", () => {
  it("addItem fires onChange", () => {
    const c = baseChar();
    const { es, onChange } = mkState(c);
    es.addItem("longsword", {});
    expect(c.equipment).toHaveLength(1);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("equip with conflict returns conflict and does NOT fire onChange", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[plate]]", equipped: true, slot: "armor" },
      { item: "[[studded-leather]]" },
    ];
    const { es, onChange } = mkState(c);
    const r = es.equipItem(1);
    expect(r.kind).toBe("conflict");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setCurrency fires onChange and persists", () => {
    const c = baseChar();
    const { es, onChange } = mkState(c);
    es.setCurrency("gp", 250);
    expect(c.currency!.gp).toBe(250);
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe("builder equipment mutators (SP2 Equipment step)", () => {
  it("syncStartingEquipment replaces only builder:starting entries and does NOT touch currency", () => {
    const c = baseChar();
    const { es } = mkState(c);
    // A non-starting builder entry that MUST survive re-syncs.
    c.equipment.push({ item: "[[hand-axe]]", granted_by: "builder:gold-buy" });
    es.syncStartingEquipment([{ slug: "srd_chain-mail", qty: 1, equipped: true, slot: "armor" }]);
    es.syncStartingEquipment([{ slug: "srd_leather", qty: 1, equipped: true, slot: "armor" }]); // re-pick
    const starting = c.equipment.filter((e) => e.granted_by === "builder:starting");
    expect(starting).toHaveLength(1);
    expect(starting[0].item).toBe("[[srd_leather]]");
    expect(c.equipment.some((e) => e.granted_by === "builder:gold-buy")).toBe(true);
    // baseChar() has NO currency key, so a surviving write in this method would
    // first have to materialize the object (the deleted inline
    // `if (!this.character.currency) …` init did exactly that). This assertion
    // genuinely fails if the write is still there.
    expect(c.currency).toBeUndefined();
  });

  it("setBuilderEquipmentMode clears all builder:* gear and persists the mode", () => {
    const c = baseChar();
    const { es } = mkState(c);
    c.equipment.push({ item: "[[x]]", granted_by: "builder:starting" });
    c.equipment.push({ item: "[[y]]", granted_by: "builder:gold-buy" });
    c.equipment.push({ item: "[[keep]]" }); // untagged survives
    es.setBuilderEquipmentMode("empty");
    expect(c.builder_equipment_mode).toBe("empty");
    expect(c.equipment).toHaveLength(1);
    expect(c.equipment[0].item).toBe("[[keep]]");
  });

  it("finishBuild strips granted_by + builder_equipment_mode", () => {
    const c = baseChar();
    const { es } = mkState(c);
    c.equipment.push({ item: "[[x]]", granted_by: "builder:starting" });
    c.builder_equipment_mode = "starting";
    es.finishBuild();
    expect(c.equipment[0].granted_by).toBeUndefined();
    expect(c.builder_equipment_mode).toBeUndefined();
  });

  it("syncStartingEquipment is a NO-OP (no onChange) when entries are unchanged", () => {
    const c = baseChar();
    const { es, onChange } = mkState(c);
    es.syncStartingEquipment([{ slug: "srd_chain-mail", qty: 1, equipped: true, slot: "armor" }]);
    onChange.mockClear();
    es.syncStartingEquipment([{ slug: "srd_chain-mail", qty: 1, equipped: true, slot: "armor" }]);
    expect(onChange).not.toHaveBeenCalled();
  });

  // G4 · the reported bug, at unit level. Pre-fix this fired onChange and set gp to 0.
  it("syncStartingEquipment is a NO-OP when entries are unchanged but gp differs (the reported bug)", () => {
    const c = baseChar();
    c.currency = { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 };
    const { es, onChange } = mkState(c);
    es.syncStartingEquipment([]);   // Volker's shape: nothing resolves
    expect(c.currency.gp).toBe(10);
    expect(onChange).not.toHaveBeenCalled();
  });
});
