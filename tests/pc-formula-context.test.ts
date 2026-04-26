import { describe, it, expect } from "vitest";
import { resolveTag } from "../src/shared/dnd/formula-tags";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";

const registry = buildEquipmentRegistry();
const baseAbilities = { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

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
