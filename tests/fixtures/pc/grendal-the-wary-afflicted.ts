/**
 * Grendal the Wary, mid-combat: unconscious (HP 0/44), poisoned and frightened,
 * exhaustion level 1, inspiration 1, 2 hit dice spent (of 5), 1 success +
 * 1 failure on death saves. Exercises SP4 visual-mode transitions (unconscious
 * → alive when healed) and persistence of multiple state fields in one
 * round-trip.
 *
 * Kept as a standalone constant rather than deriving from GRENDAL_MD — the
 * base fixture's state block has a nested-brace `hit_dice` that regex
 * substitution doesn't handle cleanly. Non-state fields (class, race, skills,
 * overrides, defenses) mirror the base so the same mock entity registry
 * resolves correctly.
 */
export const GRENDAL_AFFLICTED_MD = [
  "---",
  "archivist-type: pc",
  "---",
  "",
  "```pc",
  "name: Grendal the Wary",
  "edition: '2014'",
  "race: '[[hill-folk]]'",
  "subrace: null",
  "background: '[[drifter]]'",
  "class:",
  "  - name: '[[bladesworn]]'",
  "    level: 5",
  "    subclass: '[[path-of-shadow]]'",
  "    choices:",
  "      1:",
  "        skills: [athletics, perception]",
  "        expertise: [athletics]",
  "      4:",
  "        feat: '[[sure-step]]'",
  "abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 13, cha: 8 }",
  "ability_method: point-buy",
  "skills:",
  "  proficient: [athletics, perception, insight, survival]",
  "  expertise: [athletics]",
  "equipment:",
  "  - { item: '[[longsword]]', equipped: true }",
  "  - { item: 'Traveler pack', equipped: true }",
  "overrides:",
  "  hp: { max: 44 }",
  "defenses:",
  "  resistances: [fire]",
  "  condition_immunities: [charmed]",
  "state:",
  "  hp: { current: 0, max: 44, temp: 0 }",
  "  hit_dice: { d10: { used: 2, total: 5 } }",
  "  spell_slots: {}",
  "  concentration: null",
  "  conditions: [poisoned, frightened]",
  "  inspiration: 1",
  "  exhaustion: 1",
  "  death_saves: { successes: 1, failures: 1 }",
  "```",
  "",
  "## Backstory",
  "",
  "Grendal wandered out of the hills at age seventeen...",
].join("\n");
