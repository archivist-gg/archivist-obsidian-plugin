/**
 * End-to-end integration fixture: a fictional PC ("Grendal the Wary") plus a
 * complete set of mock compendium entities (race, class, subclass, background,
 * feat, item) his sheet references. The `.md` file and the entities together
 * exercise parse → resolve → recalc → render through the full PC pipeline.
 *
 * NOTE on RaceEntity shape: `pc.recalc`'s `flattenRaceAsi()` reads
 * `ability_score_increases` (an array of `{ ability, amount }` records), so
 * the HILL_FOLK fixture uses that shape. The legacy `ability_bonuses` map is
 * kept alongside for reference but is not consumed by the recalc.
 */

export const GRENDAL_MD = [
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
  "  - { item: '[[plate]]', equipped: true }",
  "  - { item: '[[shield]]', equipped: true }",
  "  - { item: '[[longsword]]', equipped: true }",
  "  - { item: '[[cloak-of-protection]]', equipped: true, attuned: true }",
  "  - { item: 'Traveler pack', equipped: true }",
  "overrides:",
  "  hp: { max: 44 }",
  "defenses:",
  "  resistances: [fire]",
  "  condition_immunities: [charmed]",
  "state:",
  "  hp: { current: 38, max: 44, temp: 0 }",
  "  hit_dice: { d10: { used: 1, total: 5 } }",
  "  spell_slots: {}",
  "  concentration: null",
  "  conditions: []",
  "  inspiration: 1",
  "```",
  "",
  "## Backstory",
  "",
  "Grendal wandered out of the hills at age seventeen...",
].join("\n");

export const HILL_FOLK = {
  slug: "hill-folk",
  name: "Hill Folk",
  edition: "2014",
  description: "Hardy folk of the highlands.",
  size: "medium",
  speed: { walk: 25 },
  vision: { darkvision: 60 },
  traits: [
    { name: "Stonecunning", description: "You have advantage on Intelligence (History) checks related to stonework." },
    { name: "Hill Sturdiness", description: "Your Constitution score increases by 2 and Wisdom by 1." },
  ],
  // Primary shape consumed by pc.recalc (flattenRaceAsi reads this).
  ability_score_increases: [
    { ability: "con", amount: 2 },
    { ability: "wis", amount: 1 },
  ],
  // Legacy alternate shape, harmless (not read by the recalc).
  ability_bonuses: { con: 2, wis: 1 },
  languages: ["common", "hill-dialect"],
};

export const BLADESWORN = {
  slug: "bladesworn",
  name: "Bladesworn",
  edition: "2014",
  description: "Oathbound warriors of blade and will.",
  hit_die: "d10",
  primary_abilities: ["str"],
  saving_throws: ["str", "con"],
  proficiencies: {
    armor: ["light", "medium", "shield"],
    weapons: { fixed: [], categories: ["simple", "martial"] },
    tools: { fixed: [] },
  },
  subclass_level: 3,
  features_by_level: {
    1: [
      { name: "Sworn Blade", description: "Your bound weapon deals +1 damage." },
      { name: "Fighting Style", description: "Pick a style." },
    ],
    2: [{ name: "Oath Strike", description: "Once per turn, add damage die." }],
    3: [{ name: "Subclass Feature", description: "Choose your path." }],
    5: [{ name: "Extra Attack", description: "Attack twice per Attack action." }],
    9: [{ name: "Relentless", description: "Rally on a miss." }],
  },
};

export const PATH_OF_SHADOW = {
  slug: "path-of-shadow",
  name: "Path of Shadow",
  edition: "2014",
  description: "Bind yourself to shadows.",
  features_by_level: {
    3: [{ name: "Shadow Step", description: "Teleport between shadows." }],
    7: [{ name: "Cloak of Night", description: "Become invisible in dim light." }],
  },
};

export const DRIFTER = {
  slug: "drifter",
  name: "Drifter",
  edition: "2014",
  description: "Always on the road.",
  proficiencies: { skills: ["insight", "survival"], tools: [], languages: ["thieves-cant"] },
  feature: { name: "Wanderer's Way", description: "You always know where you are." },
};

export const SURE_STEP = {
  slug: "sure-step",
  name: "Sure-Step",
  edition: "2014",
  description: "Difficult terrain costs you no extra movement.",
};

export const LONGSWORD = {
  slug: "longsword",
  name: "Longsword",
  category: "martial",
  damage: "1d8 slashing",
};
