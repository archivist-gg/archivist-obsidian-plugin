import { describe, it, expect } from "vitest";
import { buildDecisionLedger, collectChosenProficiencies, __matchesFilterForTest } from "../src/modules/pc/pc.decision-engine";
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

describe("buildDecisionLedger — decision descriptions (smoke r7)", () => {
  it("threads the source class feature's description onto the DecisionItem", () => {
    const ledger = buildDecisionLedger(resolvedFighter(1), { registry } as never);
    const fs = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "fighting-style")!;
    // resolvedFighter's Fighting Style feature carries description "Choose one option…".
    expect(fs.description).toBe("Choose one option…");
  });

  it("threads an origin race-trait's description onto its origin DecisionItem; children inherit none", () => {
    const c = resolvedFighter(1);
    const race = {
      slug: "srd-2024_elf", name: "Elf", choices: [],
      traits: [{
        name: "Elven Lineage",
        description: "Choose a lineage.\n\n| Lineage | Benefit |\n| --- | --- |\n| Drow | Darkvision |",
        choices: [{
          kind: "select-inline", id: "elven-lineage", count: 1,
          options: [{ value: "drow", label: "Drow" }, { value: "wood-elf", label: "Wood Elf" }],
        }],
      }],
    };
    (c as { race: unknown }).race = race;
    const ledger = buildDecisionLedger(c, { registry } as never);
    const lineage = ledger.origin.find(i => i.key === "elven-lineage")!;
    expect(lineage.description).toContain("| Lineage | Benefit |");   // the pipe table is carried verbatim
    // A select-inline child reveals when its parent option is chosen; it inherits
    // NO description (the Choice union has no description field).
    (c.definition as { origin_choices: Record<string, unknown> }).origin_choices = {};
  });

  it("a revealed select-inline child carries no inherited description", () => {
    const choices = { 4: { "asi-or-feat": "asi" } };
    const ledger = buildDecisionLedger(resolvedFighter(4, choices), { registry } as never);
    const aof = ledger.classes[0].levels.flatMap(l => l.items).find(i => i.key === "asi-or-feat")!;
    expect(aof.description).toBe("choose one…");          // the parent feature's description
    expect(aof.children?.[0].description).toBeUndefined(); // the child inherits nothing
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

describe("collectChosenProficiencies", () => {
  it("folds chosen L1 skills (first class) into skills, dropping stale slugs", () => {
    // from = ["athletics", "perception"]; "arcana" is outside the pool → dropped.
    const c = resolvedFighter(1, { 1: { skills: ["athletics", "perception", "arcana"] } });
    const out = collectChosenProficiencies(c);
    expect(out.skills.sort()).toEqual(["athletics", "perception"]);
    expect(out.skills).not.toContain("arcana");
    expect(out.expertise).toEqual([]);
  });

  it("routes an expertise select-proficiency decision into expertise", () => {
    const c = resolvedFighter(1);
    // Inject an expertise feature at L1 carrying a select-proficiency choice.
    const expFeature = {
      id: "expertise", name: "Expertise", description: "Pick two.",
      choices: [{ kind: "select-proficiency", id: "expertise", count: 2, domain: "skill",
        expertise: true, from: ["athletics", "stealth"] }],
    };
    (c.classes[0].entity as { features_by_level: Record<number, unknown[]> }).features_by_level[1].push(expFeature);
    c.features.push({ feature: expFeature, source: { kind: "class", slug: "srd-2024_fighter", level: 1 } } as never);
    c.classes[0].choices[1] = { ...(c.classes[0].choices[1] ?? {}), expertise: ["athletics"] } as never;
    const out = collectChosenProficiencies(c);
    expect(out.expertise).toEqual(["athletics"]);
    expect(out.skills).not.toContain("athletics");
  });

  it("walks a nested select-inline branch to collect a tool pick", () => {
    const c = resolvedFighter(1);
    const inlineFeature = {
      id: "trade", name: "Guild Trade", description: "Choose a guild.",
      choices: [{ kind: "select-inline", id: "trade", options: [
        { value: "smith", label: "Smith", choices: [
          { kind: "select-proficiency", id: "smith-tool", count: 1, domain: "tool",
            from: ["smiths-tools", "tinkers-tools"] },
        ] },
      ] }],
    };
    (c.classes[0].entity as { features_by_level: Record<number, unknown[]> }).features_by_level[1].push(inlineFeature);
    c.features.push({ feature: inlineFeature, source: { kind: "class", slug: "srd-2024_fighter", level: 1 } } as never);
    c.classes[0].choices[1] = { ...(c.classes[0].choices[1] ?? {}), trade: "smith", "smith-tool": ["smiths-tools"] } as never;
    const out = collectChosenProficiencies(c);
    expect(out.tools).toEqual(["smiths-tools"]);
  });

  it("collects an origin race-trait language pick into languages", () => {
    const c = resolvedFighter(1);
    const race = {
      slug: "srd-2024_half-elf", name: "Half-Elf",
      choices: [],
      traits: [{ name: "Versatile", choices: [
        { kind: "select-proficiency", id: "extra-language", count: 1, domain: "language",
          from: ["elvish", "dwarvish"] },
      ] }],
    };
    (c as { race: unknown }).race = race;
    (c.definition as { origin_choices: Record<string, unknown> }).origin_choices = { "race:extra-language": ["elvish"] };
    const out = collectChosenProficiencies(c);
    expect(out.languages).toEqual(["elvish"]);
  });
});

// ── chosen-feat children (SP2 Plan 5: surface a chosen feat's own decisions) ──
//
// When the L4 asi-or-feat branch resolves to a concrete feat, that feat's own
// `choices` (e.g. Ability Score Improvement's ability-points pick, Magic
// Initiate's two select-inline picks) must surface as ledger children under the
// feat select-entity, namespaced `feat:<choiceId>` so they never collide with
// the asi-branch's literal `asi` key.
describe("buildDecisionLedger — chosen-feat children", () => {
  // A feat-aware registry: the engine resolves the chosen feat slug here to read
  // its `choices`. Keyed by both the registered slug and the bare slug.
  const feats: RegisteredEntity[] = [
    { slug: "srd-2024_ability-score-improvement", name: "Ability Score Improvement",
      entityType: "feat", filePath: "asi.md",
      data: { choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }] },
      compendium: "SRD 2024", readonly: true, homebrew: false },
    { slug: "srd-2024_magic-initiate", name: "Magic Initiate", entityType: "feat", filePath: "mi.md",
      data: { choices: [
        { kind: "select-inline", id: "spell-list", count: 1, options: [
          { value: "cleric", label: "Cleric" }, { value: "wizard", label: "Wizard" }] },
        { kind: "select-inline", id: "spellcasting-ability", count: 1, options: [
          { value: "int", label: "Intelligence" }, { value: "wis", label: "Wisdom" }] },
      ] },
      compendium: "SRD 2024", readonly: true, homebrew: false },
    { slug: "srd-2024_alert", name: "Alert", entityType: "feat", filePath: "al.md",
      data: { choices: [] }, compendium: "SRD 2024", readonly: true, homebrew: false },
  ];
  const featRegistry = {
    search: (_q: string, type: string) => feats.filter((s) => s.entityType === type),
    getByTypeAndSlug: (type: string, slug: string) =>
      feats.find((s) => s.entityType === type && (s.slug === slug || s.slug.endsWith(`_${slug}`))),
  };

  // The feat branch of the L4 asi-or-feat item.
  const featBranchChild = (
    choices: Record<number, Record<string, unknown>>,
  ) => {
    const ledger = buildDecisionLedger(resolvedFighter(4, choices), { registry: featRegistry } as never);
    const aof = ledger.classes[0].levels.flatMap((l) => l.items).find((i) => i.key === "asi-or-feat")!;
    return aof.children?.find((c) => c.key === "feat");
  };

  it("surfaces ONE ability-points child (key feat:asi) for a chosen ASI feat", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_ability-score-improvement]]" },
    })!;
    expect(featItem.children).toHaveLength(1);
    const child = featItem.children![0];
    expect(child.key).toBe("feat:asi");
    expect(child.choice.kind).toBe("ability-points");
    expect((child.choice as { points: number }).points).toBe(2);
    expect((child.choice as { max_per: number }).max_per).toBe(2);
  });

  it("downgrades the feat item to partial when the feat child is unresolved", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_ability-score-improvement]]" },
    })!;
    // feat:asi has no allocation yet → child unresolved → feat item partial.
    expect(featItem.children![0].status).toBe("unresolved");
    expect(featItem.status).toBe("partial");
  });

  it("resolves the feat item once the namespaced feat:asi allocation is full", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_ability-score-improvement]]", "feat:asi": { str: 2 } },
    })!;
    expect(featItem.children![0].status).toBe("resolved");
    expect(featItem.status).toBe("resolved");
  });

  it("surfaces Magic Initiate's two select-inline children, namespaced feat:*", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_magic-initiate]]" },
    })!;
    expect(featItem.children).toHaveLength(2);
    expect(featItem.children!.map((c) => c.key)).toEqual(["feat:spell-list", "feat:spellcasting-ability"]);
    expect(featItem.children!.every((c) => c.choice.kind === "select-inline")).toBe(true);
  });

  it("does not collide the chosen-feat asi child with the legacy asi-branch key", () => {
    // Same level carries BOTH a stale asi-branch allocation AND a feat pick with
    // its own feat:asi allocation; they must read independently.
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", asi: { dex: 2 },
        feat: "[[srd-2024_ability-score-improvement]]", "feat:asi": { str: 1, con: 1 } },
    })!;
    const child = featItem.children![0];
    expect(child.selected).toEqual({ str: 1, con: 1 }); // reads feat:asi, NOT the asi-branch dex
  });

  it("adds no children for an unresolvable feat slug, and does not crash", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_does-not-exist]]" },
    })!;
    expect(featItem.children).toBeUndefined();
  });

  it("adds no children for a feat whose choices are empty", () => {
    const featItem = featBranchChild({
      4: { "asi-or-feat": "feat", feat: "[[srd-2024_alert]]" },
    })!;
    expect(featItem.children).toBeUndefined();
  });

  it("grows NO children for a subclass select-entity pick", () => {
    // A class feature whose decision is a subclass select-entity must never gain
    // children even though it is a select-entity — feat scope is exclusive.
    const subFeature = {
      id: "subclass-feature", name: "Martial Archetype", description: "Choose a subclass.",
      choices: [{ kind: "select-entity", id: "subclass", count: 1, entity_type: "subclass" }],
    };
    const c = resolvedFighter(4, { 4: {} });
    (c.classes[0].entity as { features_by_level: Record<number, unknown[]> }).features_by_level[3] = [subFeature];
    c.features.push({ feature: subFeature, source: { kind: "class", slug: "srd-2024_fighter", level: 3 } } as never);
    const ledger = buildDecisionLedger(c, { registry: featRegistry } as never);
    const sub = ledger.classes[0].levels.flatMap((l) => l.items).find((i) => i.key === "subclass")!;
    expect(sub.children).toBeUndefined();
  });
});

// ── subclass-pick guarantee (Fix B) ──────────────────────────────────────────
//
// The owned ledger must always offer the subclass pick once subclass_level is
// reached — even for the one class (2024 Bard) whose runtime JSON lacks the
// authored select-entity. The synthesized item filters candidates by
// parent_class==="self" and writes through the SAME setSubclass path (key
// "subclass", choice.entity_type "subclass") as the authored item.
describe("buildDecisionLedger — subclass-pick guarantee", () => {
  // Two Bard subclasses (parent_class → Bard) and one Fighter subclass (must be
  // excluded by the parent_class==="self" filter).
  const subclasses: RegisteredEntity[] = [
    { slug: "srd-2024_college-of-lore", name: "College of Lore", entityType: "subclass", filePath: "lore.md",
      data: { parent_class: "[[SRD 2024/Classes/Bard]]", features_by_level: {} },
      compendium: "SRD 2024", readonly: true, homebrew: false },
    { slug: "srd-2024_college-of-valor", name: "College of Valor", entityType: "subclass", filePath: "valor.md",
      data: { parent_class: "[[SRD 2024/Classes/Bard]]", features_by_level: {} },
      compendium: "SRD 2024", readonly: true, homebrew: false },
    { slug: "srd-2024_champion", name: "Champion", entityType: "subclass", filePath: "champ.md",
      data: { parent_class: "[[SRD 2024/Classes/Fighter]]", features_by_level: {} },
      compendium: "SRD 2024", readonly: true, homebrew: false },
  ];
  const subRegistry = {
    search: (_q: string, type: string) => subclasses.filter((s) => s.entityType === type),
    getByTypeAndSlug: (type: string, slug: string) =>
      subclasses.find((s) => s.entityType === type && s.slug === slug),
  };

  /** Bard-shaped resolved character: subclass_level 3, subclass_feature_name set,
   *  NO authored subclass select-entity anywhere (the 2024 Bard gap). The L3
   *  "Bard Subclass" feature is a plain feature (no choices). */
  function resolvedBard(level: number, subclass: { slug: string } | null = null): ResolvedCharacter {
    const subFeature = { id: "bard-subclass", name: "Bard Subclass", description: "You gain a Bard subclass." };
    const entity = {
      slug: "srd-2024_bard", name: "Bard",
      skill_choices: { count: 3, from: ["arcana", "deception"] },
      subclass_level: 3, subclass_feature_name: "Bard Subclass",
      features_by_level: { 1: [], 3: [subFeature] }, starting_equipment: [],
    };
    const definition = {
      name: "T", edition: "2024", race: null, subrace: null, background: null,
      class: [{ name: "[[bard]]", level, subclass: subclass ? `[[${subclass.slug}]]` : null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual", skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
        conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
    } as unknown as ResolvedCharacter["definition"];
    const cls = { entity, level, subclass, choices: {} } as unknown as ResolvedCharacter["classes"][number];
    const features = level >= 3
      ? [{ feature: subFeature, source: { kind: "class", slug: entity.slug, level: 3 } }]
      : [];
    return { definition, race: null, classes: [cls], background: null, feats: [],
      totalLevel: level, features, spells: [], state: definition.state } as unknown as ResolvedCharacter;
  }

  it("synthesizes a subclass pick at subclass_level, filtered by parent_class, unresolved when unset", () => {
    const ledger = buildDecisionLedger(resolvedBard(3), { registry: subRegistry } as never);
    const items = ledger.classes[0].levels.flatMap((l) => l.items);
    const sub = items.find((i) => i.key === "subclass")!;
    expect(sub).toBeDefined();
    expect(sub.level).toBe(3);
    expect(sub.status).toBe("unresolved");
    expect(sub.choice.kind).toBe("select-entity");
    expect((sub.choice as { entity_type: string }).entity_type).toBe("subclass");
    // Only the two Bard subclasses — the Fighter Champion is filtered out.
    expect(sub.options.map((o) => o.value).sort())
      .toEqual(["srd-2024_college-of-lore", "srd-2024_college-of-valor"]);
  });

  it("marks the synthesized pick resolved when ClassEntry.subclass is set", () => {
    const ledger = buildDecisionLedger(
      resolvedBard(5, { slug: "srd-2024_college-of-lore" }), { registry: subRegistry } as never);
    const sub = ledger.classes[0].levels.flatMap((l) => l.items).find((i) => i.key === "subclass")!;
    expect(sub.status).toBe("resolved");
    expect(sub.selected).toBe("srd-2024_college-of-lore");
  });

  it("does NOT synthesize before subclass_level (class level 2 < 3)", () => {
    const ledger = buildDecisionLedger(resolvedBard(2), { registry: subRegistry } as never);
    const sub = ledger.classes[0].levels.flatMap((l) => l.items).find((i) => i.key === "subclass");
    expect(sub).toBeUndefined();
  });

  it("emits exactly ONE subclass row when the class authors its own select-entity (no duplicate)", () => {
    // Cleric-shaped: the L3 feature carries the authored subclass select-entity,
    // so the guarantee must NOT add a second row (mirrors the browse-walker
    // 'Cleric Subclass' vs 'Cleric Subclasses' dedupe regression case).
    const authoredFeature = {
      id: "divine-domain", name: "Divine Domain", description: "Choose a domain.",
      choices: [{ kind: "select-entity", id: "subclass", count: 1, entity_type: "subclass",
        where: { parent_class: "self" } }],
    };
    const entity = {
      slug: "srd-2024_cleric", name: "Cleric",
      skill_choices: { count: 2, from: ["history", "religion"] },
      subclass_level: 3, subclass_feature_name: "Cleric Subclass",
      features_by_level: { 3: [authoredFeature] }, starting_equipment: [],
    };
    const definition = {
      name: "T", edition: "2024", race: null, subrace: null, background: null,
      class: [{ name: "[[cleric]]", level: 3, subclass: null, choices: {} }],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_method: "manual", skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
      state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
        conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
    } as unknown as ResolvedCharacter["definition"];
    const cls = { entity, level: 3, subclass: null, choices: {} } as unknown as ResolvedCharacter["classes"][number];
    const features = [{ feature: authoredFeature, source: { kind: "class", slug: entity.slug, level: 3 } }];
    const resolved = { definition, race: null, classes: [cls], background: null, feats: [],
      totalLevel: 3, features, spells: [], state: definition.state } as unknown as ResolvedCharacter;
    // A cleric subclass so the authored where-filter has a candidate.
    const clericSub: RegisteredEntity = { slug: "srd-2024_life-domain", name: "Life Domain",
      entityType: "subclass", filePath: "life.md",
      data: { parent_class: "[[SRD 2024/Classes/Cleric]]", features_by_level: {} },
      compendium: "SRD 2024", readonly: true, homebrew: false };
    const reg = {
      search: (_q: string, type: string) => (type === "subclass" ? [clericSub] : []),
      getByTypeAndSlug: (type: string, slug: string) =>
        type === "subclass" && slug === clericSub.slug ? clericSub : undefined,
    };
    const ledger = buildDecisionLedger(resolved, { registry: reg } as never);
    const subs = ledger.classes[0].levels.flatMap((l) => l.items).filter((i) => i.key === "subclass");
    expect(subs).toHaveLength(1);
    expect(subs[0].featureName).toBe("Divine Domain"); // the authored row, not a synthesized "Cleric Subclass"
  });
});

// ── Task B2: matchesFilter weapon/armor category ─────────────────────────────
// Real entity field names (confirmed in weapon.types.ts / armor.types.ts): BOTH
// weapons and armor store their class in a `category` field. Weapons use
// compound lowercase values (e.g. "martial-melee", "simple-ranged"); armor uses
// plain lowercase values ("light"|"medium"|"heavy"|"shield"). The filter VALUE
// is plain ("simple"|"martial" / "light"|... ); the engine prefix-matches the
// weapon category and exact-matches the armor category.
describe("matchesFilter weapon/armor category", () => {
  const ent = (data: object): RegisteredEntity =>
    ({ slug: "x", name: "X", entityType: "weapon", filePath: "x.md", data,
       compendium: "SRD 2024", readonly: true, homebrew: false } as RegisteredEntity);
  it("matches martial weapons", () => {
    // martial-* matches "martial"; simple-* does not.
    expect(__matchesFilterForTest(ent({ category: "martial-melee" }), { weapon_category: "martial" }, "fighter")).toBe(true);
    expect(__matchesFilterForTest(ent({ category: "martial-ranged" }), { weapon_category: "martial" }, "fighter")).toBe(true);
    expect(__matchesFilterForTest(ent({ category: "simple-melee" }), { weapon_category: "martial" }, "fighter")).toBe(false);
    expect(__matchesFilterForTest(ent({ category: "simple-melee" }), { weapon_category: "simple" }, "fighter")).toBe(true);
    expect(__matchesFilterForTest(ent({ category: "natural" }), { weapon_category: "martial" }, "fighter")).toBe(false);
  });
  it("matches armor by category and shields", () => {
    expect(__matchesFilterForTest(ent({ category: "heavy" }), { armor_category: "heavy" }, "x")).toBe(true);
    expect(__matchesFilterForTest(ent({ category: "shield" }), { armor_category: "shield" }, "x")).toBe(true);
    expect(__matchesFilterForTest(ent({ category: "light" }), { armor_category: "heavy" }, "x")).toBe(false);
  });
});
