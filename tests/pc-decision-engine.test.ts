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
