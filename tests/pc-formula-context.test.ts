import { describe, it, expect } from "vitest";
import { resolveTag } from "../src/shared/dnd/formula-tags";
import { buildFormulaContext } from "../src/modules/pc/pc.formula-context";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { Character, ResolvedCharacter } from "../src/modules/pc/pc.types";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";

const registry = buildEquipmentRegistry();
const baseAbilities = { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

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

const mkResolved = (definition: Character): ResolvedCharacter => ({
  definition, race: null, classes: [], background: null, feats: [], totalLevel: 1,
  features: [], state: definition.state,
});

describe("resolveTag with slug terms", () => {
  it("dmg:1d8+STR+[[longsword]] → 1d8+STR (longsword has no weapon_damage)", () => {
    const r = resolveTag("dmg", "1d8+STR+[[longsword]]", {
      abilities: baseAbilities,
      proficiencyBonus: 2,
      compendium: registry,
    });
    expect(r.display).toBe("1d8+3");
  });

  it("dmg:1d8+STR+[[plus-one-longsword]] → adds +1 from compendium bonus", () => {
    const r = resolveTag("dmg", "1d8+STR+[[plus-one-longsword]]", {
      abilities: baseAbilities,
      proficiencyBonus: 2,
      compendium: registry,
    });
    expect(r.display).toBe("1d8+4");
  });

  it("atk:STR+PB+[[plus-one-longsword]] → +6 (3 STR + 2 PB + 1 magic)", () => {
    const r = resolveTag("atk", "STR+PB+[[plus-one-longsword]]", {
      abilities: baseAbilities,
      proficiencyBonus: 2,
      compendium: registry,
    });
    expect(r.display).toBe("+6");
  });

  it("missing slug → '?' indicator + warning fallthrough", () => {
    const r = resolveTag("atk", "STR+[[ghost-blade]]", {
      abilities: baseAbilities,
      proficiencyBonus: 2,
      compendium: registry,
    });
    expect(r.display).toContain("?");
  });

  it("no compendium context → existing behavior (slug ignored, '?' indicator)", () => {
    const r = resolveTag("atk", "STR+[[longsword]]", {
      abilities: baseAbilities,
      proficiencyBonus: 2,
    });
    expect(r.display).toContain("?");
  });
});

describe("buildFormulaContext", () => {
  it("populates abilities, proficiencyBonus, compendium", () => {
    const c = baseChar(); c.abilities.str = 16;
    const resolved = mkResolved(c);
    const derived = recalc(resolved, registry);
    const ctx = buildFormulaContext(resolved, derived, registry);
    expect(ctx.abilities.str).toBe(16);
    expect(ctx.proficiencyBonus).toBe(derived.proficiencyBonus);
    expect(ctx.compendium).toBe(registry);
  });
});
