import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { parsePC } from "../src/modules/pc/pc.parser";
import type { Character, DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

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

function makeState(over?: (c: Character) => void): { es: CharacterEditState; char: Character; onChange: ReturnType<typeof vi.fn> } {
  const parsed = parsePC(MINIMAL_YAML);
  if (!parsed.success) throw new Error(parsed.error);
  const char = parsed.data;
  over?.(char);
  const onChange = vi.fn();
  const es = new CharacterEditState(
    char,
    () => ({
      resolved: { classes: [{ entity: { saving_throws: ["str", "con"] } }] } as unknown as ResolvedCharacter,
      derived: { hp: { max: 24, current: char.state.hp.current, temp: char.state.hp.temp } } as unknown as DerivedStats,
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

  it("clearSaveOverride removes the ability from overrides.saves", () => {
    const { es, char } = makeState((c) => {
      c.overrides.saves = { dex: { bonus: 0, proficient: true } };
    });
    es.clearSaveOverride("dex");
    expect(char.overrides.saves?.dex).toBeUndefined();
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
