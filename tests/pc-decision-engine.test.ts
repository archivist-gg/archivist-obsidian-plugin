import { describe, it, expect } from "vitest";
import { buildDecisionLedger } from "../src/modules/pc/pc.decision-engine";
import type { ResolvedCharacter } from "../src/modules/pc/pc.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

const styles: RegisteredEntity[] = [
  { slug: "archery", name: "Archery", entityType: "optional-feature", filePath: "a.md",
    data: { feature_type: "fighting_style", available_to: ["[[SRD 2024/Classes/Fighter]]"] },
    compendium: "SRD 2024", readonly: true, homebrew: false },
  { slug: "defense", name: "Defense", entityType: "optional-feature", filePath: "d.md",
    data: { feature_type: "fighting_style", available_to: ["[[SRD 2024/Classes/Fighter]]", "[[SRD 2024/Classes/Paladin]]"] },
    compendium: "SRD 2024", readonly: true, homebrew: false },
];

// A minimal sorcerer-flavoured pool for the multiclass pin.
const metamagics: RegisteredEntity[] = [
  { slug: "quickened", name: "Quickened Spell", entityType: "optional-feature", filePath: "q.md",
    data: { feature_type: "metamagic", available_to: ["[[SRD 2024/Classes/Sorcerer]]"] },
    compendium: "SRD 2024", readonly: true, homebrew: false },
  { slug: "subtle", name: "Subtle Spell", entityType: "optional-feature", filePath: "s.md",
    data: { feature_type: "metamagic", available_to: ["[[SRD 2024/Classes/Sorcerer]]"] },
    compendium: "SRD 2024", readonly: true, homebrew: false },
];

const allEntities = [...styles, ...metamagics];
const multiRegistry = {
  search: (_q: string, type: string) => allEntities.filter(s => s.entityType === type),
  getByTypeAndSlug: (type: string, slug: string) =>
    allEntities.find(s => s.entityType === type && s.slug === slug),
};

const registry = {
  search: (_q: string, type: string) => styles.filter(s => s.entityType === type),
  getByTypeAndSlug: (type: string, slug: string) => styles.find(s => s.entityType === type && s.slug === slug),
};

function resolvedFighter(level: number, choices: Record<number, Record<string, unknown>> = {}): ResolvedCharacter {
  const fsFeature = {
    id: "fighting-style", name: "Fighting Style", description: "Choose one option…",
    choices: [{ kind: "select-entity", id: "fighting-style", count: 1, entity_type: "optional-feature",
      where: { feature_type: "fighting_style", available_to: "self" } }],
  };
  const asiFeature = {
    id: "ability-score-improvement", name: "Ability Score Improvement", description: "choose one…",
    choices: [{ kind: "select-inline", id: "asi-or-feat", count: 1, options: [
      { value: "asi", label: "ASI", choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }] },
      { value: "feat", label: "Feat", choices: [{ kind: "select-entity", id: "feat", entity_type: "feat", count: 1 }] },
    ] }],
  };
  const entity = { slug: "srd-2024_fighter", name: "Fighter", skill_choices: { count: 2, from: ["athletics", "perception"] },
    features_by_level: { 1: [fsFeature], 4: [asiFeature] }, starting_equipment: [] };
  const definition = {
    name: "T", edition: "2024", race: null, subrace: null, background: null,
    class: [{ name: "[[fighter]]", level, subclass: null, choices }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
      conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  } as unknown as ResolvedCharacter["definition"];
  const cls = { entity, level, subclass: null, choices } as unknown as ResolvedCharacter["classes"][number];
  const features = Object.entries(entity.features_by_level)
    .filter(([l]) => Number(l) <= level)
    .flatMap(([l, fs]) => fs.map(f => ({ feature: f, source: { kind: "class", slug: entity.slug, level: Number(l) } })));
  return { definition, race: null, classes: [cls], background: null, feats: [],
    totalLevel: level, features, spells: [], state: definition.state } as unknown as ResolvedCharacter;
}

/**
 * Fighter (idx 0) + a minimal second class with its own entity slug and a single
 * decision-bearing feature at L1. Used to pin per-class routing in the ledger.
 */
function resolvedMulticlass(): ResolvedCharacter {
  const fsFeature = {
    id: "fighting-style", name: "Fighting Style", description: "Choose one option…",
    choices: [{ kind: "select-entity", id: "fighting-style", count: 1, entity_type: "optional-feature",
      where: { feature_type: "fighting_style", available_to: "self" } }],
  };
  const mmFeature = {
    id: "metamagic", name: "Metamagic", description: "Choose two options…",
    choices: [{ kind: "select-entity", id: "metamagic", count: 2, entity_type: "optional-feature",
      where: { feature_type: "metamagic", available_to: "self" } }],
  };
  const fighter = { slug: "srd-2024_fighter", name: "Fighter",
    skill_choices: { count: 2, from: ["athletics", "perception"] },
    features_by_level: { 1: [fsFeature] }, starting_equipment: [] };
  const sorcerer = { slug: "srd-2024_sorcerer", name: "Sorcerer",
    skill_choices: { count: 2, from: ["arcana", "deception"] },
    features_by_level: { 1: [mmFeature] }, starting_equipment: [] };

  const definition = {
    name: "T", edition: "2024", race: null, subrace: null, background: null,
    class: [
      { name: "[[fighter]]", level: 1, subclass: null, choices: {} },
      { name: "[[sorcerer]]", level: 1, subclass: null, choices: {} },
    ],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
      conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  } as unknown as ResolvedCharacter["definition"];

  const classes = [
    { entity: fighter, level: 1, subclass: null, choices: {} },
    { entity: sorcerer, level: 1, subclass: null, choices: {} },
  ] as unknown as ResolvedCharacter["classes"];
  const features = [
    { feature: fsFeature, source: { kind: "class", slug: fighter.slug, level: 1 } },
    { feature: mmFeature, source: { kind: "class", slug: sorcerer.slug, level: 1 } },
  ];
  return { definition, race: null, classes, background: null, feats: [],
    totalLevel: 2, features, spells: [], state: definition.state } as unknown as ResolvedCharacter;
}

describe("buildDecisionLedger — multiclass routing", () => {
  it("routes each class's decisions under its own classIndex; skills only on class 0", () => {
    const ledger = buildDecisionLedger(resolvedMulticlass(), { registry: multiRegistry } as never);

    expect(ledger.classes.length).toBe(2);

    const class0Items = ledger.classes[0].levels.flatMap(l => l.items);
    const class1Items = ledger.classes[1].levels.flatMap(l => l.items);

    // Synthesized L1 skills decision is first-class-only (multiclass rules are Plan 5).
    expect(class0Items.filter(i => i.key === "skills")).toHaveLength(1);
    expect(class1Items.filter(i => i.key === "skills")).toHaveLength(0);

    // Fighter's fighting-style lands under class 0, never class 1.
    expect(class0Items.find(i => i.key === "fighting-style")).toBeDefined();
    expect(class1Items.find(i => i.key === "fighting-style")).toBeUndefined();
    expect(class0Items.find(i => i.key === "metamagic")).toBeUndefined();

    // Sorcerer's metamagic lands under class 1, never class 0.
    const mm = class1Items.find(i => i.key === "metamagic")!;
    expect(mm).toBeDefined();
    expect(mm.options.map(o => o.value)).toEqual(["quickened", "subtle"]);
  });
});

describe("buildDecisionLedger — feature-level", () => {
  it("collects level-gated decisions with unresolved status", () => {
    const ledger = buildDecisionLedger(resolvedFighter(1), { registry } as never);
    const items = ledger.classes[0].levels.flatMap(l => l.items);
    const fs = items.find(i => i.key === "fighting-style")!;
    expect(fs.level).toBe(1);
    expect(fs.status).toBe("unresolved");
    expect(fs.options.map(o => o.value)).toEqual(["archery", "defense"]);
    expect(items.find(i => i.key === "asi-or-feat")).toBeUndefined(); // L4 not reached
  });

  it("joins persisted selections → resolved, and reveals nested children", () => {
    const ledger = buildDecisionLedger(
      resolvedFighter(4, { 1: { "fighting-style": "defense" }, 4: { "asi-or-feat": "asi", asi: { str: 1, con: 1 } } }),
      { registry } as never);
    const items = ledger.classes[0].levels.flatMap(l => l.items);
    expect(items.find(i => i.key === "fighting-style")!.status).toBe("resolved");
    const aof = items.find(i => i.key === "asi-or-feat")!;
    expect(aof.status).toBe("resolved");
    expect(aof.children?.[0].key).toBe("asi");
    expect(aof.children?.[0].status).toBe("resolved"); // 2 points allocated
  });

  it("marks partial allocations and unresolvable from-slugs", () => {
    const ledger = buildDecisionLedger(
      resolvedFighter(4, { 4: { "asi-or-feat": "asi", asi: { str: 1 } } }), { registry } as never);
    const aof = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "asi-or-feat")!;
    expect(aof.children?.[0].status).toBe("partial"); // 1 of 2 points
  });

  it("synthesizes the L1 skills decision from class.skill_choices", () => {
    const ledger = buildDecisionLedger(resolvedFighter(1), { registry } as never);
    const sk = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "skills")!;
    expect(sk.level).toBe(1);
    expect(sk.choice.kind).toBe("select-proficiency");
    expect(sk.options).toHaveLength(2);
  });
});

describe("buildDecisionLedger — starting equipment", () => {
  it("synthesizes an equipment-0 decision from a choice entry; ignores fixed entries", () => {
    const c = resolvedFighter(1);
    (c.classes[0].entity as { starting_equipment: unknown[] }).starting_equipment = [
      { kind: "choice", options: ["(a) X", "(b) Y"] },
      { kind: "fixed", items: ["A pack"] },
    ];
    const ledger = buildDecisionLedger(c, { registry } as never);
    const items = ledger.classes[0].levels.flatMap(l => l.items);
    const eq = items.find(i => i.key === "equipment-0")!;
    expect(eq).toBeDefined();
    expect(eq.level).toBe(1);
    expect(eq.choice.kind).toBe("select-inline");
    expect(eq.options.map(o => o.label)).toEqual(["(a) X", "(b) Y"]);
    // The fixed entry yields no decision.
    expect(items.find(i => i.key === "equipment-1")).toBeUndefined();
  });
});

describe("buildDecisionLedger — recognizer fallback wiring", () => {
  // A class whose features carry NO authored choices, so the engine must
  // consult recognizeDecision (the homebrew fallback path).
  function homebrewClass(): ResolvedCharacter {
    const expertiseFeature = {
      id: "expertise", name: "Expertise", description: "Choose two of your skill proficiencies…",
    };
    const proseFeature = {
      id: "spooky-echo", name: "Spooky Echo", description: "Choose one of the following echoes.",
    };
    const entity = { slug: "hb_rogue", name: "Rogue",
      skill_choices: { count: 0, from: [] },
      features_by_level: { 1: [expertiseFeature, proseFeature] }, starting_equipment: [] };
    const definition = {
      name: "T", edition: "2024", race: null, subrace: null, background: null,
      class: [{ name: "[[rogue]]", level: 1, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual", skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
        conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
    } as unknown as ResolvedCharacter["definition"];
    const cls = { entity, level: 1, subclass: null, choices: {} } as unknown as ResolvedCharacter["classes"][number];
    const features = [
      { feature: expertiseFeature, source: { kind: "class", slug: entity.slug, level: 1 } },
      { feature: proseFeature, source: { kind: "class", slug: entity.slug, level: 1 } },
    ];
    return { definition, race: null, classes: [cls], background: null, feats: [],
      totalLevel: 1, features, spells: [], state: definition.state } as unknown as ResolvedCharacter;
  }

  it("synthesizes a select-proficiency item for a feature mapped by id", () => {
    const ledger = buildDecisionLedger(homebrewClass(), { registry } as never);
    const exp = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "expertise")!;
    expect(exp).toBeDefined();
    expect(exp.choice.kind).toBe("select-proficiency");
    expect(exp.status).toBe("unresolved");
  });

  it("emits an informational item for unmapped decision prose", () => {
    const ledger = buildDecisionLedger(homebrewClass(), { registry } as never);
    const echo = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.featureName === "Spooky Echo")!;
    expect(echo).toBeDefined();
    expect(echo.status).toBe("informational");
    expect(echo.options).toEqual([]);
  });

  // Pins `!choices?.length`: an EMPTY ARRAY must behave like undefined, so a
  // recognizer-mapped feature still gets its synthesized decision.
  it("treats an empty choices array like undefined for recognizer-mapped features", () => {
    const c = homebrewClass();
    const expertise = c.features.find(f => f.feature.id === "expertise")!.feature as { choices?: unknown[] };
    expertise.choices = [];
    const ledger = buildDecisionLedger(c, { registry } as never);
    const exp = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "expertise")!;
    expect(exp).toBeDefined();
    expect(exp.choice.kind).toBe("select-proficiency");
    expect(exp.status).toBe("unresolved");
  });
});
