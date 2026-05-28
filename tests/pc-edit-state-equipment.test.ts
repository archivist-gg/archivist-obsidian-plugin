import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import type { Character } from "../src/modules/pc/pc.types";

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
