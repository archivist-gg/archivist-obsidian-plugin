import { describe, it, expect, vi } from "vitest";
import { CharacterEditState, type EditStateContext } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { parsePC } from "@archivist-gg/dnd5e/pc/pc.parser";
import { computeEffectiveProficiencies } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import { toProfSlug } from "@archivist-gg/dnd5e/pc/pc.proficiency-normalize";
import { buildEquipmentRegistry } from "./fixtures/pc/equipment-fixtures";
import type { Character, DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

const MINIMAL_YAML = [
  "name: Grendal",
  "edition: '2014'",
  "race: null",
  "subrace: null",
  "background: null",
  "class:",
  "  - name: '[[bladesworn]]'",
  "    level: 3",
  "    subclass: null",
  "    choices: {}",
  "abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }",
  "ability_method: manual",
  "skills: { proficient: [], expertise: [] }",
  "spells: { known: [], overrides: [] }",
  "equipment: []",
  "overrides: {}",
  "state:",
  "  hp: { current: 24, max: 24, temp: 0 }",
  "  hit_dice:",
  "    d10: { used: 0, total: 3 }",
  "  spell_slots: {}",
  "  concentration: null",
  "  conditions: []",
  "  inspiration: 0",
].join("\n");

/**
 * `derivedDefenses` seeds `getContext().derived.defenses`, which the R4-P5 defense
 * mutators read to decide whether a removal needs a SUPPRESSION. Without it the first
 * `removeDefense` call dies on `Cannot read properties of undefined (reading 'resistances')`.
 * All four buckets default to empty, so every pre-existing caller is unaffected.
 *
 * The seed is STATIC: it does not recompute between mutator calls, which is exactly what
 * the production closure does too (`pc.view.ts:154` closes over `this.derived`, recomputed
 * only in `handleChange` at `:177`, i.e. AFTER the mutator's `onChange()`).
 */
function makeState(
  over?: (c: Character) => void,
  derivedDefenses?: Partial<DerivedStats["defenses"]>,
): { es: CharacterEditState; char: Character; onChange: ReturnType<typeof vi.fn> } {
  const parsed = parsePC(MINIMAL_YAML);
  if (!parsed.success) throw new Error(parsed.error);
  const char = parsed.data;
  over?.(char);
  const onChange = vi.fn();
  const es = new CharacterEditState(
    char,
    () => ({
      resolved: { classes: [{ entity: { saving_throws: ["str", "con"] } }] } as unknown as ResolvedCharacter,
      derived: {
        hp: { max: 24, current: char.state.hp.current, temp: char.state.hp.temp },
        defenses: {
          resistances: [], immunities: [], vulnerabilities: [], condition_immunities: [],
          ...derivedDefenses,
        },
      } as unknown as DerivedStats,
    }),
    onChange,
  );
  return { es, char, onChange };
}

describe("CharacterEditState — HP", () => {
  it("heal(5) adds 5, capped at derived.hp.max", () => {
    const { es, char, onChange } = makeState((c) => { c.state.hp.current = 20; });
    es.heal(5);
    expect(char.state.hp.current).toBe(24);  // capped at 24
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("heal with current=0 clears death_saves", () => {
    const { es, char } = makeState((c) => {
      c.state.hp.current = 0;
      c.state.death_saves = { successes: 2, failures: 1 };
    });
    es.heal(3);
    expect(char.state.hp.current).toBe(3);
    expect(char.state.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("heal does NOT clear death_saves when HP stays at 0", () => {
    const { es, char } = makeState((c) => {
      c.state.hp.current = 0;
      c.state.death_saves = { successes: 1, failures: 0 };
    });
    es.heal(0);
    expect(char.state.death_saves).toEqual({ successes: 1, failures: 0 });
  });

  it("damage(8) subtracts from temp first then current, floored at 0", () => {
    const { es, char } = makeState((c) => { c.state.hp.current = 20; c.state.hp.temp = 5; });
    es.damage(8);
    expect(char.state.hp.temp).toBe(0);
    expect(char.state.hp.current).toBe(17);  // 20 - (8 - 5)
  });

  it("damage floors current at 0, never negative", () => {
    const { es, char } = makeState((c) => { c.state.hp.current = 3; c.state.hp.temp = 0; });
    es.damage(10);
    expect(char.state.hp.current).toBe(0);
  });

  it("damage does NOT auto-clear death_saves", () => {
    const { es, char } = makeState((c) => {
      c.state.hp.current = 5;
      c.state.death_saves = { successes: 1, failures: 0 };
    });
    es.damage(10);
    expect(char.state.hp.current).toBe(0);
    expect(char.state.death_saves).toEqual({ successes: 1, failures: 0 });
  });

  it("heal / damage / setTempHP silently no-op on NaN input", () => {
    const { es, char, onChange } = makeState((c) => { c.state.hp.current = 10; c.state.hp.temp = 2; });
    es.heal(NaN);
    es.damage(NaN);
    es.setTempHP(NaN);
    expect(char.state.hp.current).toBe(10);
    expect(char.state.hp.temp).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CharacterEditState — temp HP", () => {
  it("setTempHP clamps negative to 0", () => {
    const { es, char } = makeState((c) => { c.state.hp.temp = 5; });
    es.setTempHP(-3);
    expect(char.state.hp.temp).toBe(0);
  });

  it("setTempHP unconditionally replaces (does not stack with prior value)", () => {
    // Pins current behavior: whatever the caller passes wins, even if lower.
    // Widget layer (Task 7) owns the 2014-RAW "new replaces old only if higher" decision.
    const { es, char } = makeState((c) => { c.state.hp.temp = 8; });
    es.setTempHP(3);
    expect(char.state.hp.temp).toBe(3);
  });

  it("setTempHP fires onChange once per call", () => {
    const { es, onChange } = makeState();
    es.setTempHP(5);
    es.setTempHP(7);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("CharacterEditState — hit dice", () => {
  it("spendHitDie increments used, capped at total", () => {
    const { es, char } = makeState();
    es.spendHitDie("d10");
    expect(char.state.hit_dice.d10.used).toBe(1);
    es.spendHitDie("d10");
    es.spendHitDie("d10");
    es.spendHitDie("d10");  // should be no-op: already at total
    expect(char.state.hit_dice.d10.used).toBe(3);
  });

  it("restoreHitDie decrements used, floored at 0", () => {
    const { es, char } = makeState((c) => { c.state.hit_dice.d10.used = 2; });
    es.restoreHitDie("d10");
    expect(char.state.hit_dice.d10.used).toBe(1);
    es.restoreHitDie("d10");
    es.restoreHitDie("d10");  // no-op
    expect(char.state.hit_dice.d10.used).toBe(0);
  });

  it("spend/restore unknown die key is a no-op", () => {
    const { es, onChange } = makeState();
    es.spendHitDie("d20");
    es.restoreHitDie("d20");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setActiveHitDie updates sessionState and fires onChange", () => {
    const { es, onChange } = makeState();
    es.setActiveHitDie("d10");
    expect(es.sessionState.activeHitDie).toBe("d10");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — inspiration", () => {
  it("setInspiration clamps at 0", () => {
    const { es, char } = makeState();
    es.setInspiration(-3);
    expect(char.state.inspiration).toBe(0);
  });

  it("setInspiration accepts positive integers", () => {
    const { es, char } = makeState();
    es.setInspiration(4);
    expect(char.state.inspiration).toBe(4);
  });

  it("setInspiration fires onChange once per call", () => {
    const { es, onChange } = makeState();
    es.setInspiration(1);
    es.setInspiration(2);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("setInspiration silently no-ops on NaN input", () => {
    const { es, char, onChange } = makeState((c) => { c.state.inspiration = 1; });
    es.setInspiration(NaN);
    expect(char.state.inspiration).toBe(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CharacterEditState — toYaml", () => {
  it("returns a valid YAML string round-trippable through parsePC", () => {
    const { es } = makeState((c) => { c.state.hp.current = 10; });
    const dumped = es.toYaml();
    const reparsed = parsePC(dumped);
    expect(reparsed.success).toBe(true);
  });
});

describe("CharacterEditState — skills", () => {
  it("cycleSkill adds to proficient when neither", () => {
    const { es, char } = makeState();
    es.cycleSkill("arcana");
    expect(char.skills.proficient).toContain("arcana");
    expect(char.skills.expertise).not.toContain("arcana");
  });

  it("cycleSkill moves proficient → expertise", () => {
    const { es, char } = makeState((c) => { c.skills.proficient = ["arcana"]; });
    es.cycleSkill("arcana");
    expect(char.skills.proficient).not.toContain("arcana");
    expect(char.skills.expertise).toContain("arcana");
  });

  it("cycleSkill removes from expertise → none", () => {
    const { es, char } = makeState((c) => { c.skills.expertise = ["arcana"]; });
    es.cycleSkill("arcana");
    expect(char.skills.proficient).not.toContain("arcana");
    expect(char.skills.expertise).not.toContain("arcana");
  });

  it("cycleSkill normalizes 'in both' to 'none'", () => {
    const { es, char } = makeState((c) => {
      c.skills.proficient = ["arcana"];
      c.skills.expertise = ["arcana"];
    });
    es.cycleSkill("arcana");
    expect(char.skills.proficient).not.toContain("arcana");
    expect(char.skills.expertise).not.toContain("arcana");
  });
});

describe("CharacterEditState — saves", () => {
  it("toggleSaveProficient writes NOT effective — class grants str+con, flipping str sets override=false", () => {
    const { es, char } = makeState();
    // str is class-derived proficient; toggling should set override to false
    es.toggleSaveProficient("str");
    expect(char.overrides.saves?.str?.proficient).toBe(false);
  });

  it("toggleSaveProficient on a class-non-proficient ability sets override=true", () => {
    const { es, char } = makeState();
    es.toggleSaveProficient("dex");
    expect(char.overrides.saves?.dex?.proficient).toBe(true);
  });

  it("toggleSaveProficient flips existing override", () => {
    const { es, char } = makeState((c) => {
      c.overrides.saves = { dex: { bonus: 0, proficient: true } };
    });
    es.toggleSaveProficient("dex");
    expect(char.overrides.saves?.dex?.proficient).toBe(false);
  });

  it("toggleSaveProficient on fresh state writes only proficient (no bonus:0)", () => {
    // Bug 2 regression guard: writing `{ bonus: 0, proficient }` caused
    // recalc's `override?.bonus ?? savingThrow(...)` to return 0 since
    // `0 ?? x === 0`. The override must omit `bonus` entirely on first toggle.
    const { es, char } = makeState();
    es.toggleSaveProficient("dex");
    expect(char.overrides.saves?.dex).toEqual({ proficient: true });
    expect(char.overrides.saves?.dex).not.toHaveProperty("bonus", 0);
    expect(char.overrides.saves?.dex?.bonus).toBeUndefined();
  });

  it("toggleSaveProficient preserves existing bonus when flipping", () => {
    const { es, char } = makeState((c) => {
      c.overrides.saves = { dex: { bonus: 3, proficient: true } };
    });
    es.toggleSaveProficient("dex");
    expect(char.overrides.saves?.dex?.bonus).toBe(3);
    expect(char.overrides.saves?.dex?.proficient).toBe(false);
  });

  it("clearSaveProficientOverride removes the ability from overrides.saves", () => {
    const { es, char } = makeState((c) => {
      c.overrides.saves = { dex: { proficient: true } };
    });
    es.clearSaveProficientOverride("dex");
    expect(char.overrides.saves?.dex).toBeUndefined();
  });
});

describe("CharacterEditState — save bonus override (SP4c)", () => {
  it("setSaveBonusOverride materializes parent and writes bonus", () => {
    const { es, char, onChange } = makeState();
    expect(char.overrides.saves).toBeUndefined();
    es.setSaveBonusOverride("str", 7);
    expect(char.overrides.saves).toEqual({ str: { bonus: 7 } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setSaveBonusOverride preserves an existing proficient flag on the same ability", () => {
    const { es, char } = makeState((c) => { c.overrides.saves = { str: { proficient: true } }; });
    es.setSaveBonusOverride("str", 7);
    expect(char.overrides.saves?.str).toEqual({ proficient: true, bonus: 7 });
  });

  it("setSaveBonusOverride clamps to [-20, 30] and floors", () => {
    const { es, char } = makeState();
    es.setSaveBonusOverride("dex", -9999);
    expect(char.overrides.saves?.dex?.bonus).toBe(-20);
    es.setSaveBonusOverride("dex", 9999);
    expect(char.overrides.saves?.dex?.bonus).toBe(30);
    es.setSaveBonusOverride("dex", 5.9);
    expect(char.overrides.saves?.dex?.bonus).toBe(5);
  });

  it("setSaveBonusOverride no-ops on NaN", () => {
    const { es, char, onChange } = makeState();
    es.setSaveBonusOverride("str", NaN);
    expect(char.overrides.saves).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clearSaveBonusOverride deletes the bonus half but keeps proficient", () => {
    const { es, char } = makeState((c) => { c.overrides.saves = { str: { bonus: 7, proficient: true } }; });
    es.clearSaveBonusOverride("str");
    expect(char.overrides.saves?.str).toEqual({ proficient: true });
  });

  it("clearSaveBonusOverride drops the entry when proficient is unset", () => {
    const { es, char } = makeState((c) => { c.overrides.saves = { str: { bonus: 7 } }; });
    es.clearSaveBonusOverride("str");
    expect(char.overrides.saves?.str).toBeUndefined();
  });

  it("clearSaveBonusOverride drops the parent when last save entry is cleared", () => {
    const { es, char } = makeState((c) => { c.overrides.saves = { str: { bonus: 7 } }; });
    es.clearSaveBonusOverride("str");
    expect(char.overrides.saves).toBeUndefined();
  });

  it("clearSaveProficientOverride drops the entry when bonus is unset (regression)", () => {
    const { es, char } = makeState((c) => { c.overrides.saves = { str: { proficient: true } }; });
    es.clearSaveProficientOverride("str");
    expect(char.overrides.saves).toBeUndefined();
  });
});

describe("CharacterEditState — conditions", () => {
  it("toggleCondition adds when absent", () => {
    const { es, char } = makeState();
    es.toggleCondition("prone");
    expect(char.state.conditions).toContain("prone");
  });

  it("toggleCondition removes when present", () => {
    const { es, char } = makeState((c) => { c.state.conditions = ["prone"]; });
    es.toggleCondition("prone");
    expect(char.state.conditions).not.toContain("prone");
  });

  it("setExhaustion clamps to [0, 6]", () => {
    const { es, char } = makeState();
    es.setExhaustion(3);
    expect(char.state.exhaustion).toBe(3);
    es.setExhaustion(99);
    expect(char.state.exhaustion).toBe(6);
    es.setExhaustion(-1);
    expect(char.state.exhaustion).toBe(0);
  });

  it("setExhaustion silently no-ops on NaN input", () => {
    const { es, char, onChange } = makeState((c) => { c.state.exhaustion = 2; });
    es.setExhaustion(NaN);
    expect(char.state.exhaustion).toBe(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("CharacterEditState — active buffs", () => {
  it("toggleActiveBuff adds the slug when absent and fires onChange", () => {
    const { es, char, onChange } = makeState();
    es.toggleActiveBuff("majesty");
    expect(char.state.active_buffs).toEqual(["majesty"]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("toggleActiveBuff removes the slug and clears the array back to undefined when empty", () => {
    const { es, char } = makeState((c) => { c.state.active_buffs = ["majesty"]; });
    es.toggleActiveBuff("majesty");
    expect(char.state.active_buffs).toBeUndefined();
  });

  it("toggleActiveBuff removing one of several leaves the rest", () => {
    const { es, char } = makeState((c) => { c.state.active_buffs = ["a", "majesty", "b"]; });
    es.toggleActiveBuff("majesty");
    expect(char.state.active_buffs).toEqual(["a", "b"]);
  });
});

describe("CharacterEditState — death saves", () => {
  it("toggleDeathSaveSuccess flips that index on the successes mask (0 → 1 → 0)", () => {
    const { es, char } = makeState();
    es.toggleDeathSaveSuccess(0);
    expect(char.state.death_saves?.successes).toBe(1);
    es.toggleDeathSaveSuccess(1);
    expect(char.state.death_saves?.successes).toBe(2);
    es.toggleDeathSaveSuccess(0);
    expect(char.state.death_saves?.successes).toBe(1);
  });

  it("toggleDeathSaveFailure flips that index on the failures counter", () => {
    const { es, char } = makeState();
    es.toggleDeathSaveFailure(0);
    expect(char.state.death_saves?.failures).toBe(1);
    es.toggleDeathSaveFailure(2);
    expect(char.state.death_saves?.failures).toBe(2);
  });

  it("clearDeathSaves zeroes both counters and fires onChange", () => {
    const { es, char, onChange } = makeState((c) => {
      c.state.death_saves = { successes: 2, failures: 1 };
    });
    es.clearDeathSaves();
    expect(char.state.death_saves).toEqual({ successes: 0, failures: 0 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — HP overrides (SP4b)", () => {
  it("setCurrentHp clamps to [0, derived.hp.max]", () => {
    const { es, char, onChange } = makeState((c) => { c.state.hp.current = 20; });
    es.setCurrentHp(999);
    expect(char.state.hp.current).toBe(24); // derived.hp.max in fixture
    es.setCurrentHp(-5);
    expect(char.state.hp.current).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("setCurrentHp crossing 0→positive clears death_saves", () => {
    const { es, char } = makeState((c) => {
      c.state.hp.current = 0;
      c.state.death_saves = { successes: 2, failures: 1 };
    });
    es.setCurrentHp(8);
    expect(char.state.hp.current).toBe(8);
    expect(char.state.death_saves).toEqual({ successes: 0, failures: 0 });
  });

  it("setCurrentHp staying at 0 preserves death_saves", () => {
    const { es, char } = makeState((c) => {
      c.state.hp.current = 0;
      c.state.death_saves = { successes: 1, failures: 2 };
    });
    es.setCurrentHp(0);
    expect(char.state.death_saves).toEqual({ successes: 1, failures: 2 });
  });

  it("setMaxHpOverride stores override, clamps min to 1, triggers onChange", () => {
    const { es, char, onChange } = makeState();
    es.setMaxHpOverride(40);
    expect(char.overrides.hp?.max).toBe(40);
    es.setMaxHpOverride(0);
    expect(char.overrides.hp?.max).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("setMaxHpOverride clamps state.hp.current down if new max is lower", () => {
    const { es, char } = makeState((c) => { c.state.hp.current = 24; });
    es.setMaxHpOverride(10);
    expect(char.state.hp.current).toBe(10);
  });

  it("setMaxHpOverride above current does NOT raise current", () => {
    const { es, char } = makeState((c) => { c.state.hp.current = 15; });
    es.setMaxHpOverride(40);
    expect(char.state.hp.current).toBe(15);
  });

  it("setMaxHpOverride does not touch state.hp.temp in either direction", () => {
    const { es, char } = makeState((c) => { c.state.hp.temp = 7; });
    es.setMaxHpOverride(5);
    expect(char.state.hp.temp).toBe(7);
  });

  it("clearMaxHpOverride deletes the key and drops overrides.hp if empty", () => {
    const { es, char } = makeState();
    es.setMaxHpOverride(40);
    expect(char.overrides.hp).toBeDefined();
    es.clearMaxHpOverride();
    expect(char.overrides.hp).toBeUndefined();
  });
});

describe("rolled HP + HP modifier setters (P5)", () => {
  it("setRolledHp floors + min-1 and writes overrides.hp.rolled; NO current clamp", () => {
    const { es, char } = makeState((c) => { c.state.hp.current = 20; });
    es.setRolledHp(12.9);
    expect(char.overrides.hp?.rolled).toBe(12);
    expect(char.state.hp.current).toBe(20); // convention: computed-max drops don't clamp
  });
  it("clearRolledHp keeps sibling keys, deletes empty hp object", () => {
    const { es, char } = makeState();
    es.setMaxHpOverride(40); es.setRolledHp(20); es.clearRolledHp();
    expect(char.overrides.hp).toEqual({ max: 40 });
    es.clearMaxHpOverride();
    expect(char.overrides.hp).toBeUndefined();
  });
  it("setHpModifier truncates, stores negatives, 0 delegates to clear", () => {
    const { es, char } = makeState();
    es.setHpModifier(-5.7);
    expect(char.overrides.hp?.modifier).toBe(-5);
    es.setHpModifier(0);
    expect(char.overrides.hp).toBeUndefined();
  });
  it("round-trips through toYaml", () => {
    const { es } = makeState();
    es.setRolledHp(62); es.setHpModifier(-5);
    expect(es.toYaml()).toMatch(/rolled: 62/);
    expect(es.toYaml()).toMatch(/modifier: -5/);
  });
});

describe("CharacterEditState — AC overrides (SP4b)", () => {
  it("setAcOverride stores override and clamps to [0, 50]", () => {
    const { es, char, onChange } = makeState();
    es.setAcOverride(18);
    expect(char.overrides.ac).toBe(18);
    es.setAcOverride(999);
    expect(char.overrides.ac).toBe(50);
    es.setAcOverride(-5);
    expect(char.overrides.ac).toBe(0);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("clearAcOverride deletes the key", () => {
    const { es, char } = makeState();
    es.setAcOverride(18);
    expect(char.overrides.ac).toBe(18);
    es.clearAcOverride();
    expect(char.overrides.ac).toBeUndefined();
  });

  it("clearAcOverride when no override exists is a no-op but still notifies", () => {
    const { es, onChange } = makeState();
    es.clearAcOverride();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — ability score overrides (SP4b)", () => {
  it("setScoreOverride stores override per ability, clamped to [1, 30]", () => {
    const { es, char } = makeState();
    es.setScoreOverride("str", 20);
    expect(char.overrides.scores?.str).toBe(20);
    es.setScoreOverride("dex", 999);
    expect(char.overrides.scores?.dex).toBe(30);
    es.setScoreOverride("con", 0);
    expect(char.overrides.scores?.con).toBe(1);
  });

  it("setScoreOverride allows different abilities independently", () => {
    const { es, char } = makeState();
    es.setScoreOverride("str", 18);
    es.setScoreOverride("wis", 14);
    expect(char.overrides.scores?.str).toBe(18);
    expect(char.overrides.scores?.wis).toBe(14);
    expect(char.overrides.scores?.dex).toBeUndefined();
  });

  it("clearScoreOverride removes a single ability and drops overrides.scores when empty", () => {
    const { es, char } = makeState();
    es.setScoreOverride("str", 18);
    es.setScoreOverride("wis", 14);
    es.clearScoreOverride("str");
    expect(char.overrides.scores?.str).toBeUndefined();
    expect(char.overrides.scores?.wis).toBe(14);
    es.clearScoreOverride("wis");
    expect(char.overrides.scores).toBeUndefined();
  });
});

describe("CharacterEditState — defenses (SP4b)", () => {
  it("addDefense materializes defenses and the target array on first write", () => {
    const { es, char } = makeState((c) => { delete c.defenses; });
    es.addDefense("resistances", "fire");
    expect(char.defenses?.resistances).toEqual(["fire"]);
  });

  it("addDefense dedupes existing entries", () => {
    const { es, char, onChange } = makeState();
    es.addDefense("resistances", "fire");
    es.addDefense("resistances", "fire");
    expect(char.defenses?.resistances).toEqual(["fire"]);
    // R4-P5 Task 6: the duplicate is a no-op, and a no-op must not dirty the file.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("addDefense keeps kinds independent", () => {
    const { es, char } = makeState();
    es.addDefense("resistances", "fire");
    es.addDefense("immunities", "poison");
    es.addDefense("vulnerabilities", "radiant");
    expect(char.defenses?.resistances).toEqual(["fire"]);
    expect(char.defenses?.immunities).toEqual(["poison"]);
    expect(char.defenses?.vulnerabilities).toEqual(["radiant"]);
  });

  it("removeDefense removes an entry and keeps array if others remain", () => {
    const { es, char } = makeState();
    es.addDefense("resistances", "fire");
    es.addDefense("resistances", "cold");
    es.removeDefense("resistances", "fire");
    expect(char.defenses?.resistances).toEqual(["cold"]);
  });

  it("removeDefense on missing entry is a no-op and does NOT notify", () => {
    const { es, char, onChange } = makeState();
    es.removeDefense("resistances", "acid");
    expect(char.defenses?.resistances ?? []).toEqual([]);
    // R4-P5 Task 6: nothing in the manual list and nothing in `derived` · no dirty.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("addConditionImmunity stores slug in defenses.condition_immunities", () => {
    const { es, char } = makeState((c) => { delete c.defenses; });
    es.addConditionImmunity("charmed");
    expect(char.defenses?.condition_immunities).toEqual(["charmed"]);
  });

  it("addConditionImmunity dedupes", () => {
    const { es, char } = makeState();
    es.addConditionImmunity("charmed");
    es.addConditionImmunity("charmed");
    expect(char.defenses?.condition_immunities).toEqual(["charmed"]);
  });

  it("removeConditionImmunity removes a slug", () => {
    const { es, char } = makeState();
    es.addConditionImmunity("charmed");
    es.addConditionImmunity("frightened");
    es.removeConditionImmunity("charmed");
    expect(char.defenses?.condition_immunities).toEqual(["frightened"]);
  });
});

/**
 * R4-P5 Task 6 · the defense mutators are POSTCONDITION pairs, not token swaps.
 *
 * Every fixture below authors a spelling that DIFFERS from the canonical slug
 * ("Psychic"/"psychic", "Fire"/"fire", "Charmed"/"charmed"). That is deliberate: the
 * buckets previously seeded `label === value` everywhere, which made it impossible for
 * any assertion to prove WHICH field a caller read or WHICH spelling a mutator stored.
 */
const GRANT_PSYCHIC = { value: "psychic", label: "Psychic", origin: "grant" as const };
const MANUAL_FIRE = { value: "fire", label: "Fire", origin: "manual" as const };
const MANUAL_COLD = { value: "cold", label: "Cold", origin: "manual" as const };

describe("CharacterEditState: defenses · postcondition pair (R4-P5 Task 6)", () => {
  it("suppresses a granted defense instead of no-oping, storing the RAW spelling", () => {
    const { es, char, onChange } = makeState(undefined, { resistances: [GRANT_PSYCHIC] });
    es.removeDefense("resistances", "Psychic");
    expect(char.overrides.defenses?.resistances?.remove).toEqual(["Psychic"]);
    // A key-less note stays key-less: nothing was in the manual list to splice.
    expect(char.defenses).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("suppresses per bucket · a resistance suppression leaves the other three absent", () => {
    const { es, char } = makeState(undefined, { immunities: [GRANT_PSYCHIC] });
    es.removeDefense("immunities", "psychic");
    expect(char.overrides.defenses?.immunities?.remove).toEqual(["psychic"]);
    expect(Object.keys(char.overrides.defenses ?? {})).toEqual(["immunities"]);
  });

  it("matches the manual list CANONICALLY, not by identity", () => {
    // The panel hands the mutator `entry.value` (canonical) while the note authored "Fire".
    // An `indexOf` compare misses this and the chip never leaves the sheet.
    const { es, char } = makeState(
      (c) => { c.defenses = { resistances: ["Fire"], immunities: [], vulnerabilities: [], condition_immunities: [] }; },
      { resistances: [MANUAL_FIRE] },
    );
    es.removeDefense("resistances", "fire");
    // Purely manual · NO suppression, and every bucket is now empty so the key goes away.
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();
  });

  it("does not write a suppression when removing a purely manual defense", () => {
    const { es, char } = makeState(
      (c) => { c.defenses = { resistances: ["Fire", "Cold"], immunities: [], vulnerabilities: [], condition_immunities: [] }; },
      { resistances: [MANUAL_FIRE, MANUAL_COLD] },
    );
    es.removeDefense("resistances", "Fire");
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses?.resistances).toEqual(["Cold"]);
  });

  it("writes the suppression once, whatever spelling the second tap uses", () => {
    const { es, char } = makeState(undefined, { resistances: [GRANT_PSYCHIC] });
    es.removeDefense("resistances", "Psychic");
    es.removeDefense("resistances", "psychic");
    expect(char.overrides.defenses?.resistances?.remove).toEqual(["Psychic"]);
  });

  it("a grant-only suppress → restore round trip returns the note to its original bytes", () => {
    const { es, char, onChange } = makeState(undefined, { resistances: [GRANT_PSYCHIC] });
    es.removeDefense("resistances", "Psychic");
    es.addDefense("resistances", "Psychic");
    // Membership in remove[] was itself the proof that a non-manual source existed, so
    // stripping the suppression is sufficient · nothing is pushed to the manual list.
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("strips the suppression on a canonical match, not an exact one", () => {
    const { es, char } = makeState(undefined, { resistances: [GRANT_PSYCHIC] });
    es.removeDefense("resistances", "Psychic");   // stores "Psychic"
    es.addDefense("resistances", "psychic");      // the panel's canonical spelling
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();
  });

  it("a value supplied by BOTH the manual list and a grant loses the manual entry on a round trip", () => {
    // Spec §3.5 edge case 1. `origin` is strongest-wins, so the entry reports "grant";
    // removeDefense splices the manual entry AND suppresses, and addDefense adds nothing
    // back. LOSSY and NOT self-healing · the rendered sheet is unchanged, so severity is
    // LOW, but this is pinned so nobody "restores" the bytes claim to this case.
    const { es, char } = makeState(
      (c) => { c.defenses = { resistances: ["Psychic"], immunities: [], vulnerabilities: [], condition_immunities: [] }; },
      { resistances: [GRANT_PSYCHIC] },
    );
    es.removeDefense("resistances", "Psychic");
    expect(char.defenses).toBeUndefined();
    expect(char.overrides.defenses?.resistances?.remove).toEqual(["Psychic"]);
    es.addDefense("resistances", "Psychic");
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();   // the manual entry is gone for good
  });

  it("does not fire onChange when a removal is a no-op", () => {
    const { es, char, onChange } = makeState();
    es.removeDefense("resistances", "not-present-anywhere");
    expect(onChange).not.toHaveBeenCalled();
    // D-2's second half: a key-less note must not be re-persisted with four empty arrays.
    expect(char.defenses).toBeUndefined();
    expect(char.overrides.defenses).toBeUndefined();
  });

  it("does not fire onChange or materialize buckets when an add is a duplicate", () => {
    const { es, char, onChange } = makeState((c) => { c.defenses = { resistances: ["Fire"] }; });
    es.addDefense("resistances", "fire");
    expect(onChange).not.toHaveBeenCalled();
    expect(char.defenses?.resistances).toEqual(["Fire"]);
    expect(Object.keys(char.defenses ?? {})).toEqual(["resistances"]);
  });
});

describe("CharacterEditState: condition immunities · postcondition pair (R4-P5 Task 6)", () => {
  const GRANT_CHARMED = { value: "charmed", label: "Charmed", origin: "grant" as const };

  it("suppresses a granted condition immunity instead of no-oping", () => {
    const { es, char, onChange } = makeState(undefined, { condition_immunities: [GRANT_CHARMED] });
    es.removeConditionImmunity("Charmed");
    expect(char.overrides.defenses?.condition_immunities?.remove).toEqual(["Charmed"]);
    expect(char.defenses).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not write a suppression when removing a purely manual condition immunity", () => {
    const { es, char } = makeState(
      (c) => { c.defenses = { resistances: [], immunities: [], vulnerabilities: [], condition_immunities: ["Charmed"] }; },
      { condition_immunities: [{ value: "charmed", label: "Charmed", origin: "manual" as const }] },
    );
    es.removeConditionImmunity("charmed");
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();
  });

  it("a grant-only suppress → restore round trip returns the note to its original bytes", () => {
    const { es, char, onChange } = makeState(undefined, { condition_immunities: [GRANT_CHARMED] });
    es.removeConditionImmunity("Charmed");
    es.addConditionImmunity("charmed");
    expect(char.overrides.defenses).toBeUndefined();
    expect(char.defenses).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not fire onChange when a condition-immunity removal is a no-op", () => {
    const { es, char, onChange } = makeState();
    es.removeConditionImmunity("petrified");
    expect(onChange).not.toHaveBeenCalled();
    expect(char.defenses).toBeUndefined();
    expect(char.overrides.defenses).toBeUndefined();
  });

  it("does not fire onChange or materialize buckets when a condition immunity is added twice", () => {
    const { es, char, onChange } = makeState((c) => { c.defenses = { condition_immunities: ["Charmed"] }; });
    es.addConditionImmunity("charmed");
    expect(onChange).not.toHaveBeenCalled();
    expect(char.defenses?.condition_immunities).toEqual(["Charmed"]);
    expect(Object.keys(char.defenses ?? {})).toEqual(["condition_immunities"]);
  });

  it("accepts an off-vocabulary value · C-1 widened the signature from ConditionSlug to string", () => {
    // The picker unions in whatever `derived.condition_immunities` holds, which a homebrew
    // overlay can populate with a condition outside CONDITION_SLUGS.
    const { es, char } = makeState(undefined, {
      condition_immunities: [{ value: "dazed", label: "Dazed", origin: "grant" as const }],
    });
    es.removeConditionImmunity("Dazed");
    expect(char.overrides.defenses?.condition_immunities?.remove).toEqual(["Dazed"]);
  });
});

describe("CharacterEditState — speed override (SP4c)", () => {
  it("setSpeedOverride writes overrides.speed and notifies", () => {
    const { es, char, onChange } = makeState();
    es.setSpeedOverride(40);
    expect(char.overrides.speed).toBe(40);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setSpeedOverride clamps to [0, 240]", () => {
    const { es, char } = makeState();
    es.setSpeedOverride(-10);
    expect(char.overrides.speed).toBe(0);
    es.setSpeedOverride(9999);
    expect(char.overrides.speed).toBe(240);
  });

  it("setSpeedOverride floors fractional input", () => {
    const { es, char } = makeState();
    es.setSpeedOverride(30.7);
    expect(char.overrides.speed).toBe(30);
  });

  it("setSpeedOverride silently no-ops on NaN", () => {
    const { es, char, onChange } = makeState();
    es.setSpeedOverride(NaN);
    expect(char.overrides.speed).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clearSpeedOverride deletes the key and notifies", () => {
    const { es, char, onChange } = makeState((c) => { c.overrides.speed = 40; });
    es.clearSpeedOverride();
    expect(char.overrides.speed).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — initiative override (SP4c)", () => {
  it("setInitiativeOverride writes overrides.initiative and notifies", () => {
    const { es, char, onChange } = makeState();
    es.setInitiativeOverride(5);
    expect(char.overrides.initiative).toBe(5);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setInitiativeOverride accepts negative values", () => {
    const { es, char } = makeState();
    es.setInitiativeOverride(-3);
    expect(char.overrides.initiative).toBe(-3);
  });

  it("setInitiativeOverride clamps to [-20, 30]", () => {
    const { es, char } = makeState();
    es.setInitiativeOverride(-9999);
    expect(char.overrides.initiative).toBe(-20);
    es.setInitiativeOverride(9999);
    expect(char.overrides.initiative).toBe(30);
  });

  it("setInitiativeOverride no-ops on NaN", () => {
    const { es, char, onChange } = makeState();
    es.setInitiativeOverride(NaN);
    expect(char.overrides.initiative).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clearInitiativeOverride deletes the key and notifies", () => {
    const { es, char, onChange } = makeState((c) => { c.overrides.initiative = 5; });
    es.clearInitiativeOverride();
    expect(char.overrides.initiative).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — passive sense overrides (SP4c)", () => {
  it("setPassiveOverride('perception', n) materializes parent and writes the key", () => {
    const { es, char, onChange } = makeState();
    expect(char.overrides.passives).toBeUndefined();
    es.setPassiveOverride("perception", 18);
    expect(char.overrides.passives).toEqual({ perception: 18 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setPassiveOverride for each kind preserves the others", () => {
    const { es, char } = makeState();
    es.setPassiveOverride("perception", 18);
    es.setPassiveOverride("investigation", 12);
    es.setPassiveOverride("insight", 14);
    expect(char.overrides.passives).toEqual({ perception: 18, investigation: 12, insight: 14 });
  });

  it("setPassiveOverride clamps to [0, 40] and floors", () => {
    const { es, char } = makeState();
    es.setPassiveOverride("perception", -5);
    expect(char.overrides.passives?.perception).toBe(0);
    es.setPassiveOverride("perception", 999);
    expect(char.overrides.passives?.perception).toBe(40);
    es.setPassiveOverride("perception", 18.9);
    expect(char.overrides.passives?.perception).toBe(18);
  });

  it("setPassiveOverride no-ops on NaN (no parent materialized)", () => {
    const { es, char, onChange } = makeState();
    es.setPassiveOverride("perception", NaN);
    expect(char.overrides.passives).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clearPassiveOverride deletes the key but keeps parent if other kinds set", () => {
    const { es, char } = makeState((c) => { c.overrides.passives = { perception: 18, investigation: 12 }; });
    es.clearPassiveOverride("perception");
    expect(char.overrides.passives).toEqual({ investigation: 12 });
  });

  it("clearPassiveOverride drops the parent when last key is cleared", () => {
    const { es, char } = makeState((c) => { c.overrides.passives = { perception: 18 }; });
    es.clearPassiveOverride("perception");
    expect(char.overrides.passives).toBeUndefined();
  });

  it("clearPassiveOverride is a no-op if parent is absent (still notifies for re-render parity)", () => {
    const { es, char, onChange } = makeState();
    es.clearPassiveOverride("perception");
    expect(char.overrides.passives).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("CharacterEditState — skill bonus override (SP4c)", () => {
  it("setSkillBonusOverride materializes parent and writes entry", () => {
    const { es, char, onChange } = makeState();
    expect(char.overrides.skills).toBeUndefined();
    es.setSkillBonusOverride("athletics", 12);
    expect(char.overrides.skills).toEqual({ athletics: { bonus: 12 } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("setSkillBonusOverride preserves other skill entries", () => {
    const { es, char } = makeState();
    es.setSkillBonusOverride("athletics", 12);
    es.setSkillBonusOverride("stealth", 7);
    expect(char.overrides.skills).toEqual({ athletics: { bonus: 12 }, stealth: { bonus: 7 } });
  });

  it("setSkillBonusOverride clamps to [-20, 30] and floors", () => {
    const { es, char } = makeState();
    es.setSkillBonusOverride("arcana", -9999);
    expect(char.overrides.skills?.arcana?.bonus).toBe(-20);
    es.setSkillBonusOverride("arcana", 9999);
    expect(char.overrides.skills?.arcana?.bonus).toBe(30);
    es.setSkillBonusOverride("arcana", 5.9);
    expect(char.overrides.skills?.arcana?.bonus).toBe(5);
  });

  it("setSkillBonusOverride no-ops on NaN (no parent materialized)", () => {
    const { es, char, onChange } = makeState();
    es.setSkillBonusOverride("arcana", NaN);
    expect(char.overrides.skills).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clearSkillBonusOverride drops the whole entry, no { bonus: undefined } remnant", () => {
    const { es, char } = makeState((c) => { c.overrides.skills = { athletics: { bonus: 12 }, stealth: { bonus: 7 } }; });
    es.clearSkillBonusOverride("athletics");
    expect(char.overrides.skills).toEqual({ stealth: { bonus: 7 } });
    expect(char.overrides.skills?.athletics).toBeUndefined();
  });

  it("clearSkillBonusOverride drops the parent when last skill is cleared", () => {
    const { es, char } = makeState((c) => { c.overrides.skills = { athletics: { bonus: 12 } }; });
    es.clearSkillBonusOverride("athletics");
    expect(char.overrides.skills).toBeUndefined();
  });

  it("clearSkillBonusOverride is a no-op if parent is absent (still notifies)", () => {
    const { es, char, onChange } = makeState();
    es.clearSkillBonusOverride("athletics");
    expect(char.overrides.skills).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("cycleSkill does not clear an existing bonus override (Risk #4)", () => {
    // The user's bonus assertion is independent of the proficiency state;
    // cycling proficiency via cycleSkill must not touch overrides.skills.
    const { es, char } = makeState((c) => { c.overrides.skills = { athletics: { bonus: 12 } }; });
    es.cycleSkill("athletics");
    expect(char.overrides.skills?.athletics?.bonus).toBe(12);
  });
});

describe("CharacterEditState — equipItemWithSwap (Task 3)", () => {
  const reg = buildEquipmentRegistry();
  const baseChar = (): Character => ({
    name: "T", edition: "2024", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [
      { item: "[[adamantine-breastplate]]", equipped: true, slot: "armor" },
      { item: "[[breastplate-3]]", equipped: false },
    ],
    overrides: {},
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0, feature_uses: {} },
  });

  // equipItemWithSwap never calls getContext, so a bare stub is safe. The real
  // 4-arg constructor is (character, getContext, onChange, registry).
  const makeES = (c: Character) =>
    new CharacterEditState(c, () => ({}) as unknown as EditStateContext, () => {}, reg);

  it("swaps the armor occupant and reports its name", () => {
    const c = baseChar();
    const es = makeES(c);
    const res = es.equipItemWithSwap(1);
    expect(res.unequipped).toEqual(["Adamantine Armor (Breastplate)"]);
    expect(c.equipment[0].equipped).toBe(false);   // occupant unequipped
    expect(c.equipment[1].equipped).toBe(true);     // incoming equipped
    expect(c.equipment[1].slot).toBe("armor");
  });

  it("returns {} (no swap) when the slot is free", () => {
    const c = baseChar();
    c.equipment[0].equipped = false;
    c.equipment[0].slot = undefined;
    const es = makeES(c);
    const res = es.equipItemWithSwap(1);
    expect(res.unequipped).toBeUndefined();
    expect(c.equipment[1].equipped).toBe(true);
  });

  // ─── FIX 1: two-handed weapon swap routing ──────────────────────────
  it("2H weapon while a 1H weapon holds the mainhand → 2H to mainhand, 1H unequipped, never offhand", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[longsword]]", equipped: true, slot: "mainhand" },
      { item: "[[greatsword]]", equipped: false },
    ];
    const es = makeES(c);
    const res = es.equipItemWithSwap(1);
    expect(c.equipment[1].equipped).toBe(true);
    expect(c.equipment[1].slot).toBe("mainhand");
    expect(c.equipment[1].slot).not.toBe("offhand");
    expect(c.equipment[0].equipped).toBe(false);
    expect(res.unequipped).toEqual(expect.arrayContaining(["Longsword"]));
  });

  it("2H weapon while a shield is equipped → 2H to mainhand, shield unequipped", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[shield]]", equipped: true, slot: "shield" },
      { item: "[[greatsword]]", equipped: false },
    ];
    const es = makeES(c);
    const res = es.equipItemWithSwap(1);
    expect(c.equipment[1].equipped).toBe(true);
    expect(c.equipment[1].slot).toBe("mainhand");
    expect(c.equipment[0].equipped).toBe(false);
    expect(res.unequipped).toEqual(expect.arrayContaining(["Shield"]));
  });

  it("2H weapon while BOTH a mainhand weapon AND a shield are equipped → both unequipped, 2H to mainhand", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[longsword]]", equipped: true, slot: "mainhand" },
      { item: "[[shield]]", equipped: true, slot: "shield" },
      { item: "[[greatsword]]", equipped: false },
    ];
    const es = makeES(c);
    const res = es.equipItemWithSwap(2);
    expect(c.equipment[2].equipped).toBe(true);
    expect(c.equipment[2].slot).toBe("mainhand");
    expect(c.equipment[0].equipped).toBe(false);
    expect(c.equipment[1].equipped).toBe(false);
    expect(res.unequipped).toEqual(expect.arrayContaining(["Longsword", "Shield"]));
  });
});

describe("CharacterEditState — attuneItem auto-equip (Task 4, #10)", () => {
  const reg = buildEquipmentRegistry();
  const baseChar = (): Character => ({
    name: "T", edition: "2024", race: null, subrace: null, background: null,
    class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {},
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0, feature_uses: {} },
  });

  // Returns the state plus its onChange spy so the exactly-once persist contract
  // can be asserted per path.
  const makeES = (c: Character) => {
    const onChange = vi.fn();
    const es = new CharacterEditState(c, () => ({}) as unknown as EditStateContext, onChange, reg);
    return { es, onChange };
  };

  it("attuning an unequipped equippable item auto-equips it (free slot → no swap)", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[flame-tongue]]", equipped: false }];
    const { es, onChange } = makeES(c);
    const result = es.attuneItem(0);
    expect(result.kind).toBe("ok");
    expect(c.equipment[0].attuned).toBe(true);
    expect(c.equipment[0].equipped).toBe(true);
    expect(c.equipment[0].slot).toBe("mainhand");
    expect(result.unequipped).toBeUndefined();
    // equipItemWithSwap persisted on the success path — exactly once.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("attuning into an occupied slot unequips the occupant and reports its name", () => {
    // armor-of-resistance (attune-required armor) into the single-occupancy armor
    // slot already held by adamantine-breastplate → genuine conflict + swap.
    const c = baseChar();
    c.equipment = [
      { item: "[[adamantine-breastplate]]", equipped: true, slot: "armor" },
      { item: "[[armor-of-resistance]]", equipped: false },
    ];
    const { es, onChange } = makeES(c);
    const result = es.attuneItem(1);
    expect(result.kind).toBe("ok");
    expect(c.equipment[1].attuned).toBe(true);
    expect(c.equipment[1].equipped).toBe(true);
    expect(c.equipment[1].slot).toBe("armor");
    expect(c.equipment[0].equipped).toBe(false); // occupant unequipped
    expect(result.unequipped).toEqual(["Adamantine Armor (Breastplate)"]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("attuning a slotless wondrous item (cloak) equips it worn with no slot and no swap", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[cloak-of-protection]]", equipped: false }];
    const { es, onChange } = makeES(c);
    const result = es.attuneItem(0);
    expect(result.kind).toBe("ok");
    expect(c.equipment[0].attuned).toBe(true);
    expect(c.equipment[0].equipped).toBe(true);
    expect(c.equipment[0].slot).toBeUndefined();
    expect(result.unequipped).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("attune rejected at the limit does NOT equip the item", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[cloak-of-protection]]", attuned: true, equipped: true },
      { item: "[[belt-of-hill-giant-strength]]", attuned: true, equipped: true },
      { item: "[[headband-of-intellect]]", attuned: true, equipped: true },
      { item: "[[flame-tongue]]", equipped: false }, // 4th → over the default limit of 3
    ];
    const { es, onChange } = makeES(c);
    const result = es.attuneItem(3);
    expect(result.kind).toBe("rejected");
    expect(c.equipment[3].attuned).toBeFalsy();
    expect(c.equipment[3].equipped).toBe(false);
    expect(result.unequipped).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("attuning an already-equipped item leaves it equipped with no spurious swap", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[flame-tongue]]", equipped: true, slot: "mainhand" }];
    const { es, onChange } = makeES(c);
    const result = es.attuneItem(0);
    expect(result.kind).toBe("ok");
    expect(c.equipment[0].attuned).toBe(true);
    expect(c.equipment[0].equipped).toBe(true); // still equipped
    expect(result.unequipped).toBeUndefined();  // no swap fired
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("unattuneItem never auto-unequips — equipped state is unchanged", () => {
    const c = baseChar();
    c.equipment = [{ item: "[[flame-tongue]]", equipped: true, slot: "mainhand", attuned: true }];
    const { es } = makeES(c);
    es.unattuneItem(0);
    expect(c.equipment[0].attuned).toBe(false);
    expect(c.equipment[0].equipped).toBe(true); // still equipped
    expect(c.equipment[0].slot).toBe("mainhand");
  });
});

// ─── Proficiency overrides (R4-P3b, spec §3.6 / §8) ──────────────────────────
//
// The mutators decide what to write by asking the ENGINE what is effective, via
// `getContext().resolved`. So the fixture has to reproduce the PRODUCTION ALIASING:
// `pc.view.ts:150-152` hands `parsed.data` to the edit state as `character` AND builds
// the context from the resolver's output, whose `definition` is that very object
// (`pc.resolver.ts:253` `definition: character`). One object, two paths.
//
// A fixture that CLONED would let the mutator write one object while the effective-set
// read hits another, and every assertion below would pass vacuously. The fixture-integrity
// test at the top of the describe block pins that identity so a future edit cannot quietly
// break it.
//
// The two local `makeES` helpers above cannot be reused here: both stub getContext as
// `({}) as unknown as EditStateContext`, so `resolved` is undefined and the mutators'
// effectiveness read throws on the outer dereference.
function makeDwarfEditState(onChange: () => void = () => {}): CharacterEditState {
  const parsed = parsePC(MINIMAL_YAML);
  if (!parsed.success) throw new Error(parsed.error);
  const character = parsed.data;
  const resolved = {
    definition: character,   // ALIAS, never a copy. See the note above.
    // The grant walk reads `resolved.race`, never `definition.race`, so the race lives on
    // the resolved side only · the same shape as the engine's own effective-set fixture.
    race: { name: "Dwarf", languages: { fixed: ["common", "dwarvish"] }, traits: [], choices: [] },
    classes: [],
    background: null,
    feats: [],
    features: [],
  } as unknown as ResolvedCharacter;
  const derived = { hp: { max: 24, current: 24, temp: 0 } } as unknown as DerivedStats;
  return new CharacterEditState(character, () => ({ resolved, derived }), onChange);
}

/** Re-point the race's fixed languages IN PLACE, on the object the context closure
 *  already holds, so the next effective-set read sees the new grants. Replacing
 *  `resolved` or `definition` would sever the aliasing the mutators depend on. */
function setRaceGrants(es: CharacterEditState, name: string, fixed: string[]): void {
  const race = es.getContext().resolved.race as unknown as { name: string; languages: { fixed: string[] } };
  race.name = name;
  race.languages.fixed = fixed;
}
const swapRaceToElf = (es: CharacterEditState): void => setRaceGrants(es, "Elf", ["common", "elvish"]);
const swapRaceToHuman = (es: CharacterEditState): void => setRaceGrants(es, "Human", ["common"]);

describe("proficiency overrides", () => {
  const isEffective = (es: CharacterEditState, v: string) =>
    computeEffectiveProficiencies(es.getContext().resolved).languages.some(
      (e) => toProfSlug(e.value) === toProfSlug(v),
    );

  // FIXTURE INTEGRITY, not a behaviour test. Everything below is vacuous if the edit
  // state's character and the resolved definition are two objects: the mutator would
  // write one and the effectiveness read would consult the other, so `toYaml()` could
  // never disagree with a no-op. Both halves are asserted: reference identity, and that
  // a write through the edit state is observable through the context path.
  it("FIXTURE: character and resolved.definition are the SAME object (production aliasing)", () => {
    const es = makeDwarfEditState();
    expect(es.character).toBe(es.getContext().resolved.definition);
    es.character.overrides.languages = { remove: ["probe"] };
    expect(es.getContext().resolved.definition.overrides.languages).toEqual({ remove: ["probe"] });
    // ...and the swap helpers must not sever it.
    swapRaceToElf(es);
    expect(es.character).toBe(es.getContext().resolved.definition);
  });

  it("suppress-then-restore returns the note to its ORIGINAL bytes", () => {
    const es = makeDwarfEditState();          // grants common + dwarvish
    const before = es.toYaml();
    es.removeProficiency("languages", "dwarvish");
    expect(isEffective(es, "dwarvish")).toBe(false);
    es.addProficiency("languages", "dwarvish");
    expect(isEffective(es, "dwarvish")).toBe(true);
    // Only passes if `+` re-evaluates AFTER dropping from remove[] (so it pushes nothing to add[]),
    // and if the mutator prunes the emptied container back to `delete`.
    expect(es.toYaml()).toBe(before);
  });

  it("add-then-remove of a manual entry also returns to the original bytes", () => {
    const es = makeDwarfEditState();
    const before = es.toYaml();
    es.addProficiency("languages", "elvish");
    expect(isEffective(es, "elvish")).toBe(true);
    es.removeProficiency("languages", "elvish");
    expect(isEffective(es, "elvish")).toBe(false);
    expect(es.toYaml()).toBe(before);
  });

  it("canonicalize-compares on push so one value cannot be stored twice", () => {
    const es = makeDwarfEditState();
    es.addProficiency("tools", "Thieves' Tools");
    es.addProficiency("tools", "Thieves’ Tools");   // U+2019 · same value
    expect(es.character.overrides.tools?.add).toHaveLength(1);
  });

  it("calls onChange exactly once per mutation", () => {
    const onChange = vi.fn();
    const es = makeDwarfEditState(onChange);
    es.addProficiency("languages", "elvish");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // ---- Spec §16.3 test 6: THE TWO REACHABLE FAILURE STATES. ----
  // These are the whole reason §8 was rewritten from a token swap into postconditions. Both need a
  // GRANT CHANGE between the two mutator calls; the four tests above all pass under a naive token
  // swap, so without these the states §8 exists to fix ship unpinned.

  it("add-then-granted: × removes the chip even though the value became a grant", () => {
    const es = makeDwarfEditState();
    es.addProficiency("languages", "elvish");          // manual add
    swapRaceToElf(es);                                 // elvish is NOW ALSO granted
    es.removeProficiency("languages", "elvish");
    // A token swap deletes only the add[] entry, the grant keeps it effective, and the chip stays.
    expect(isEffective(es, "elvish")).toBe(false);
    expect(es.character.overrides.languages?.remove).toContain("elvish");
  });

  it("orphaned suppression: + restores the value after its grant disappears", () => {
    const es = makeDwarfEditState();
    es.removeProficiency("languages", "dwarvish");     // suppress a grant
    swapRaceToHuman(es);                               // dwarvish is no longer granted at all
    es.addProficiency("languages", "dwarvish");
    // A token swap drops it from remove[] and pushes nothing => NO chip appears. Silent no-op.
    expect(isEffective(es, "dwarvish")).toBe(true);
  });
});
