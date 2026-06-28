// tests/fixtures/pc/rest-fixtures.ts
import type { Character } from "../../../packages/obsidian/src/modules/pc/pc.types";

/** Helper: clone a fixture so mutations in tests don't leak. */
export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Multiclass with mixed hit-dice pools, both partially spent. */
export const FIGHTER_5_CLERIC_3: Character = {
  name: "Multi",
  edition: "2014",
  race: null, subrace: null, background: null,
  class: [
    { name: "[[fighter]]", level: 5, subclass: null, choices: {} },
    { name: "[[cleric]]",  level: 3, subclass: null, choices: {} },
  ],
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 14, cha: 8 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: {
    hp: { current: 30, max: 60, temp: 0 },
    hit_dice: {
      d10: { used: 3, total: 5 },
      d8:  { used: 2, total: 3 },
    },
    spell_slots: { 1: { used: 2, total: 4 } },
    concentration: "[[bless]]",
    conditions: [],
    exhaustion: 0,
    inspiration: 0,
    feature_uses: {},
  },
};

/** Wounded wizard with all slots spent. */
export const WIZARD_5_WOUNDED: Character = {
  ...clone(FIGHTER_5_CLERIC_3),
  class: [{ name: "[[wizard]]", level: 5, subclass: null, choices: {} }],
  state: {
    ...clone(FIGHTER_5_CLERIC_3.state),
    hp: { current: 12, max: 32, temp: 0 },
    hit_dice: { d6: { used: 4, total: 5 } },
    spell_slots: { 1: { used: 4, total: 4 }, 2: { used: 3, total: 3 }, 3: { used: 2, total: 2 } },
  },
};

/** Barbarian at exhaustion 3 with rage uses spent (long-rest reset). */
export const BARBARIAN_6_EXHAUSTED: Character = {
  ...clone(FIGHTER_5_CLERIC_3),
  class: [{ name: "[[barbarian]]", level: 6, subclass: null, choices: {} }],
  state: {
    ...clone(FIGHTER_5_CLERIC_3.state),
    exhaustion: 3,
    feature_uses: { rage: { used: 3, max: 3 } },
  },
};

/** Monk with ki spent (short-rest reset). */
export const MONK_6_DRAINED: Character = {
  ...clone(FIGHTER_5_CLERIC_3),
  class: [{ name: "[[monk]]", level: 6, subclass: null, choices: {} }],
  state: {
    ...clone(FIGHTER_5_CLERIC_3.state),
    feature_uses: { ki: { used: 6, max: 6 } },
  },
};

/** PC with two magic items at different recovery cadences. */
export const PC_WITH_MAGIC_ITEMS: Character = {
  ...clone(FIGHTER_5_CLERIC_3),
  equipment: [
    {
      item: "[[bag-of-tricks]]",
      state: {
        charges: { current: 0, max: 3 },
        recovery: { amount: "3", reset: "short" },
      },
    },
    {
      item: "[[cloak-of-many-fashions]]",
      state: {
        charges: { current: 0, max: 1 },
        recovery: { amount: "1", reset: "dawn" },
      },
    },
  ],
};

/** Unconscious PC with partial death saves. */
export const PC_AT_ZERO_HP: Character = {
  ...clone(FIGHTER_5_CLERIC_3),
  state: {
    ...clone(FIGHTER_5_CLERIC_3.state),
    hp: { current: 0, max: 60, temp: 0 },
    death_saves: { successes: 1, failures: 1 },
  },
};

/**
 * Minimal `ResolvedCharacter`-like helper. Tests only need a few resolver
 * outputs (`totalLevel`, `features`, `classes`); the rest engine treats the
 * resolved view as read-only metadata.
 */
export function fakeResolved(c: Character, overrides: Partial<{
  totalLevel: number;
  features: Array<{ feature: { id?: string; name: string; resources?: Array<{ id?: string; reset: string }> }; source: unknown }>;
}> = {}) {
  const totalLevel = overrides.totalLevel
    ?? c.class.reduce((s, cl) => s + cl.level, 0);
  return {
    definition: c,
    race: null,
    classes: c.class.map((cl) => ({ entity: null, level: cl.level, subclass: null })),
    background: null,
    feats: [],
    totalLevel,
    features: overrides.features ?? [],
    state: c.state,
  } as never;
}

/** Minimal `DerivedStats` for the rest engine: only `hp.max` is read. */
export function fakeDerived(c: Character) {
  return {
    hp: { max: c.state.hp.max, current: c.state.hp.current, temp: c.state.hp.temp },
  } as never;
}
