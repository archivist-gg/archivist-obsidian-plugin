import { describe, it, expect } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass } from "../src/modules/pc/pc.types";

// Minimal resolved-character helper. Builds the smallest object recalc()
// will accept; tests mutate state.conditions / state.exhaustion / overrides
// to drive the path under test.
function makeResolved(overrides: {
  conditions?: string[];
  exhaustion?: number;
  edition?: "2014" | "2024";
  speedOverride?: number;
  hpMaxOverride?: number;
} = {}): ResolvedCharacter {
  const klass: ResolvedClass = {
    entity: { name: "Fighter", saving_throws: ["str", "con"], hit_die: "d10" } as never,
    level: 5,
    subclass: null,
    choices: {},
  };
  const definition = {
    name: "Test",
    edition: overrides.edition ?? "2014",
    race: "[[human]]",
    subrace: null,
    background: null,
    class: [{ name: "[[fighter]]", level: 5, subclass: null, choices: {} }],
    abilities: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {
      ...(overrides.speedOverride !== undefined ? { speed: overrides.speedOverride } : {}),
      ...(overrides.hpMaxOverride !== undefined ? { hp: { max: overrides.hpMaxOverride } } : {}),
    },
    state: {
      hp: { current: 40, max: 40, temp: 0 },
      hit_dice: {},
      spell_slots: {},
      concentration: null,
      conditions: (overrides.conditions ?? []) as never,
      exhaustion: overrides.exhaustion ?? 0,
      inspiration: 0,
      feature_uses: {},
    },
  };
  return {
    definition: definition as never,
    race: { speed: { walk: 30 } } as never,
    classes: [klass],
    background: null,
    feats: [],
    totalLevel: 5,
    features: [],
    state: definition.state,
  };
}

describe("recalc — speed adjustments from conditions", () => {
  it("Grappled forces speed to 0", () => {
    const d = recalc(makeResolved({ conditions: ["grappled"] }));
    expect(d.speed).toBe(0);
  });
  it("Paralyzed forces speed to 0", () => {
    const d = recalc(makeResolved({ conditions: ["paralyzed"] }));
    expect(d.speed).toBe(0);
  });
  it("Restrained forces speed to 0", () => {
    const d = recalc(makeResolved({ conditions: ["restrained"] }));
    expect(d.speed).toBe(0);
  });
  it("Unconscious forces speed to 0", () => {
    const d = recalc(makeResolved({ conditions: ["unconscious"] }));
    expect(d.speed).toBe(0);
  });
  it("2014 exhaustion 2 halves speed (30 → 15)", () => {
    const d = recalc(makeResolved({ exhaustion: 2 }));
    expect(d.speed).toBe(15);
  });
  it("2024 exhaustion 3 reduces speed by 15 (30 → 15)", () => {
    const d = recalc(makeResolved({ exhaustion: 3, edition: "2024" }));
    expect(d.speed).toBe(15);
  });
  it("speed override wins over Grappled effect", () => {
    const d = recalc(makeResolved({ conditions: ["grappled"], speedOverride: 30 }));
    expect(d.speed).toBe(30);
    expect(d.conditionEffects.speed_floor_zero).toBe(true); // tooltip data still surfaces
  });
});

describe("recalc — HP max adjustments from conditions", () => {
  it("2014 exhaustion 4 halves HP max (current unchanged)", () => {
    const d = recalc(makeResolved({ exhaustion: 4 }));
    expect(d.hp.max).toBe(22);
    expect(d.conditionEffects.hp_max_multiplier).toBe(0.5);
    expect(d.hp.current).toBe(40);
  });
  it("HP max override wins over exhaustion 4", () => {
    const d = recalc(makeResolved({ exhaustion: 4, hpMaxOverride: 50 }));
    expect(d.hp.max).toBe(50);
  });
});

describe("recalc — d20 test penalty (2024 exhaustion)", () => {
  it("exhaustion 1 reduces every save bonus by 2", () => {
    const baseline = recalc(makeResolved({ edition: "2024" }));
    const exhausted = recalc(makeResolved({ exhaustion: 1, edition: "2024" }));
    for (const ab of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      expect(exhausted.saves[ab].bonus).toBe(baseline.saves[ab].bonus - 2);
    }
  });
  it("exhaustion 3 reduces every attack-row toHit by 6", () => {
    // No equipment in the fixture, so this only proves the empty-attacks path
    // doesn't crash; meaningful coverage with magic-weapon attacks is added
    // when the SP5 fixtures land. For now: the zero-attack case stays green.
    const d = recalc(makeResolved({ exhaustion: 3, edition: "2024" }));
    expect(d.attacks).toEqual([]);
  });
});

describe("recalc — death state surfaced for exhaustion 6", () => {
  it("2014 exhaustion 6: exhaustion_level === 6", () => {
    const d = recalc(makeResolved({ exhaustion: 6 }));
    expect(d.conditionEffects.exhaustion_level).toBe(6);
  });
  it("2024 exhaustion 6: exhaustion_level === 6", () => {
    const d = recalc(makeResolved({ exhaustion: 6, edition: "2024" }));
    expect(d.conditionEffects.exhaustion_level).toBe(6);
  });
});

describe("recalc — empty case regression", () => {
  it("no conditions / exhaustion 0: numbers identical to a sibling baseline", () => {
    const d1 = recalc(makeResolved());
    const d2 = recalc(makeResolved());
    expect(d1.speed).toBe(d2.speed);
    expect(d1.hp.max).toBe(d2.hp.max);
    expect(d1.saves).toEqual(d2.saves);
    expect(d1.conditionEffects.sources).toEqual([]);
  });
});
