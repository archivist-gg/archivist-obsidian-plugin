import { describe, it, expect } from "vitest";
import { buildDecisionLedger } from "../packages/obsidian/src/modules/pc/pc.decision-engine";
import type { ResolvedCharacter, ResolvedPool } from "../packages/obsidian/src/modules/pc/pc.types";
import type { RegisteredEntity } from "@core/entity-registry";

/** Registry over a set of optional-feature slugs. `enumerateOptions` resolves a
 *  `from` list via getByTypeAndSlug (with a search-based bare-slug fallback), so
 *  the entries only need slug/name/entityType + a data blob. */
function reg(slugs: string[]) {
  const entities: RegisteredEntity[] = slugs.map((s) => ({
    slug: s, name: s, entityType: "optional-feature", filePath: `${s}.md`,
    data: { slug: s, name: s, feature_type: "interdict-boon" },
    compendium: "Homebrew", readonly: false, homebrew: true,
  }));
  return {
    registry: {
      search: (_q: string, type: string) =>
        type === "optional-feature" ? entities : [],
      getByTypeAndSlug: (type: string, slug: string) =>
        type === "optional-feature" ? entities.find((e) => e.slug === slug) : undefined,
    },
  } as never;
}

const basePool: ResolvedPool = {
  id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 3, anchorLevel: 2,
  selected: [{ slug: "baleful-glare", entity: {} as never }],
  available: [
    { slug: "baleful-glare", entity: {} as never },
    { slug: "hell-mage", entity: {} as never },
    { slug: "umbral-step", entity: {} as never },
  ],
  grants: [],
};

/** Reaver-shaped resolved character with one pool at anchorLevel 2 and one
 *  pick already persisted to class[0].choices[2]["interdict-boons"]. */
function resolved(count: number): ResolvedCharacter {
  const entity = {
    slug: "homebrew_reaver", name: "Reaver",
    subclass_level: 99, starting_equipment: [], features_by_level: {},
  };
  const definition = {
    name: "T", edition: "2024", race: null, subrace: null, background: null,
    class: [{ name: "[[reaver]]", level: 7, subclass: null, choices: { 2: { "interdict-boons": ["baleful-glare"] } } }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual", skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {}, origin_choices: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null,
      conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  } as unknown as ResolvedCharacter["definition"];
  const cls = {
    entity, level: 7, subclass: null,
    choices: { 2: { "interdict-boons": ["baleful-glare"] } },
  } as unknown as ResolvedCharacter["classes"][number];
  return {
    definition, race: null, classes: [cls], background: null, feats: [],
    totalLevel: 7, features: [], spells: [], pools: [{ ...basePool, count }],
    state: definition.state,
  } as unknown as ResolvedCharacter;
}

describe("buildDecisionLedger — pools", () => {
  it("synthesizes a select-entity decision anchored at the pool's anchorLevel", () => {
    const ledger = buildDecisionLedger(resolved(3), reg(["baleful-glare", "hell-mage", "umbral-step"]));
    const lvl2 = ledger.classes[0].levels.find((l) => l.level === 2)!;
    expect(lvl2).toBeDefined();
    const item = lvl2.items.find((i) => i.key === "interdict-boons")!;
    expect(item).toBeDefined();
    expect(item.choice.kind).toBe("select-entity");
    expect((item.choice as { count?: number }).count).toBe(3);
    expect(item.options.map((o) => o.value).sort()).toEqual(["baleful-glare", "hell-mage", "umbral-step"]);
    expect(item.status).toBe("partial"); // 1 of 3 chosen
  });

  it("omits the decision when count is 0 (below unlock level)", () => {
    const ledger = buildDecisionLedger(resolved(0), reg(["baleful-glare"]));
    const items = ledger.classes[0].levels.flatMap((l) => l.items);
    expect(items.find((i) => i.key === "interdict-boons")).toBeUndefined();
  });
});
