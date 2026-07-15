import { describe, it, expect } from "vitest";
import {
  buildActionModel,
  type Section,
  type EconomyKey,
  type SourceKey,
} from "../packages/obsidian/src/modules/pc/components/actions/action-model";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { EntityRegistry } from "@archivist-gg/core";
import type {
  AttackRow,
  DerivedStats,
  EquipmentEntry,
  ResolvedCharacter,
  ResolvedFeature,
  ResolvedPool,
  ResolvedPoolEntry,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

// ─────────────────────────────────────────────────────────────
// Fixture factories — minimal shapes buildActionModel actually reads
// (derived.attacks / derived.attacksPerAction; resolved.definition.equipment /
//  resolved.features / resolved.pools; registry.getBySlug).
// ─────────────────────────────────────────────────────────────

const attack = (over: Partial<AttackRow> = {}): AttackRow => ({
  id: "atk", name: "Longsword", range: "melee", toHit: 5,
  damageDice: "1d8+3", damageType: "slashing", properties: [], proficient: true,
  breakdown: { toHit: [], damage: [] }, ...over,
});

const feat = (
  name: string,
  action: AttackRow["actionCost"] | undefined,
  source: ResolvedFeature["source"],
  extra: Partial<ResolvedFeature> = {},
): ResolvedFeature =>
  ({ feature: { name, action }, source, ...extra }) as unknown as ResolvedFeature;

const boonEntry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({
    slug,
    entity: {
      slug, name: slug, edition: "2014", source: "", feature_type: "boon",
      description: "", prerequisites: [], available_to: [], effects: [], ...entity,
    },
  }) as unknown as ResolvedPoolEntry;

const boonPool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({
    id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 1,
    anchorLevel: 3, selected: [], available: [], grants: [], ...over,
  }) as ResolvedPool;

interface BuildOpts {
  attacks?: AttackRow[];
  attacksPerAction?: number;
  features?: ResolvedFeature[];
  pools?: ResolvedPool[];
  equipment?: EquipmentEntry[];
  registry?: EntityRegistry;
}

const build = (opts: BuildOpts = {}): Section[] => {
  const resolved = {
    definition: { equipment: opts.equipment ?? [] },
    features: opts.features ?? [],
    pools: opts.pools ?? [],
  } as unknown as ResolvedCharacter;
  const derived = {
    attacks: opts.attacks ?? [],
    attacksPerAction: opts.attacksPerAction,
  } as unknown as DerivedStats;
  return buildActionModel(resolved, derived, opts.registry ?? buildMockRegistry([]));
};

const section = (secs: Section[], key: EconomyKey) => secs.find((s) => s.key === key);
const sub = (secs: Section[], eco: EconomyKey, src: SourceKey) =>
  section(secs, eco)?.subGroups.find((g) => g.key === src);
const boonNames = (secs: Section[], eco: EconomyKey): string[] =>
  (sub(secs, eco, "boons")?.entries ?? []).map((e) => (e.kind === "boon" ? e.entry.entity.name : ""));

describe("buildActionModel", () => {
  it("buckets features by economy and source (class feature action→Actions/Class features)", () => {
    const secs = build({
      features: [feat("Invoke Hell", "action", { kind: "class", slug: "illrigger", level: 1 })],
    });
    const g = sub(secs, "actions", "class-features");
    expect(g).toBeDefined();
    expect(g!.key).toBe("class-features");
    expect(g!.label).toBe("Class features");
    expect(g!.entries).toHaveLength(1);
    const e = g!.entries[0];
    expect(e.kind).toBe("feature");
    if (e.kind !== "feature") throw new Error("expected feature entry");
    expect(e.rf.feature.name).toBe("Invoke Hell");
  });

  it("files a reaction item under Reactions → Items (not Actions)", () => {
    const registry = buildMockRegistry([
      { slug: "srd-5e_ring-of-evasion", entityType: "item", data: { name: "Ring of Evasion", rarity: "rare" } },
    ]);
    const secs = build({
      equipment: [{ item: "[[srd-5e_ring-of-evasion]]", equipped: true }] as EquipmentEntry[],
      registry,
    });
    // Ring of Evasion is a reaction item — it must NOT land under Actions.
    expect(sub(secs, "actions", "items")).toBeUndefined();
    const g = sub(secs, "reactions", "items");
    expect(g).toBeDefined();
    expect(g!.entries).toHaveLength(1);
    const e = g!.entries[0];
    expect(e.kind).toBe("item");
    if (e.kind !== "item") throw new Error("expected item entry");
    expect(e.item.action.cost).toBe("reaction");
    expect(e.item.index).toBe(0); // ORIGINAL equipment index preserved
    expect(e.item.entity?.name).toBe("Ring of Evasion");
    expect(e.item.entityType).toBe("item");
  });

  it("collects only equipped, action-bearing, non-weapon/armor items (drops the rest; CB-4 prefix)", () => {
    // Absorbs the coverage of the retired ItemsTable collection wrapper: the
    // equipped/action-bearing filter + compendium-prefix (`srd-5e_`) stripping.
    const registry = buildMockRegistry([
      { slug: "srd-5e_wand-of-fireballs", entityType: "item", data: { name: "Wand of Fireballs", rarity: "very rare" } },
      { slug: "srd-5e_hempen-rope", entityType: "item", data: { name: "Hempen Rope" } },
      { slug: "srd-5e_longsword", entityType: "weapon", data: { name: "Longsword" } },
    ]);
    const secs = build({
      equipment: [
        { item: "[[srd-5e_wand-of-fireballs]]", equipped: true },   // curated action → kept
        { item: "[[srd-5e_hempen-rope]]", equipped: true },         // no resolved action → dropped
        { item: "[[srd-5e_wand-of-fireballs]]", equipped: false },  // not equipped → dropped
        { item: "[[srd-5e_longsword]]", equipped: true },           // weapon entityType → dropped (weapons path)
      ] as EquipmentEntry[],
      registry,
    });
    const g = sub(secs, "actions", "items");
    expect(g).toBeDefined();
    expect(g!.entries).toHaveLength(1);
    const e = g!.entries[0];
    if (e.kind !== "item") throw new Error("expected item entry");
    expect(e.item.entity?.name).toBe("Wand of Fireballs");
    expect(e.item.index).toBe(0); // ORIGINAL equipment index preserved
    expect(e.item.action.max_charges).toBe(7); // curated action resolved through the srd-5e_ prefix
  });

  it("files a bonus-action weapon under Bonus Actions → Weapons (not Actions), no ×N count", () => {
    const secs = build({ attacks: [attack({ name: "Dagger", actionCost: "bonus-action" })] });
    expect(sub(secs, "actions", "weapons")).toBeUndefined();
    const g = sub(secs, "bonus", "weapons");
    expect(g).toBeDefined();
    expect(g!.count).toBeUndefined(); // ×N count only on the Actions→Weapons sub-group
    expect(g!.entries).toHaveLength(1);
    expect(g!.entries[0].kind).toBe("weapon");
  });

  it("maps boons by entity.action_cost; free→Actions, bonus/reaction map, special/passive/none→Passive", () => {
    const pool = boonPool({
      selected: [
        boonEntry("red-cant", { name: "Red Cant", action_cost: "free" }),         // → Actions
        boonEntry("shove", { name: "Shove Boon", action_cost: "bonus-action" }),  // → Bonus
        boonEntry("ward", { name: "Ward Boon", action_cost: "reaction" }),        // → Reactions
        boonEntry("special", { name: "Special Boon", action_cost: "special" }),   // → Passive
        boonEntry("stoic", { name: "Stoic", passive: true }),                     // no action_cost → Passive
        boonEntry("plain", { name: "Plain Boon" }),                               // no action_cost/passive → Passive
      ],
      grants: [boonEntry("granted-gift", { name: "Granted Gift" })],              // granted, no action_cost → Passive
    });
    const secs = build({ pools: [pool] });

    expect(boonNames(secs, "actions")).toEqual(["Red Cant"]);
    expect(boonNames(secs, "bonus")).toEqual(["Shove Boon"]);
    expect(boonNames(secs, "reactions")).toEqual(["Ward Boon"]);
    // Passive keeps insertion order: selected special/stoic/plain, then the grant.
    expect(boonNames(secs, "passive")).toEqual(["Special Boon", "Stoic", "Plain Boon", "Granted Gift"]);

    // status + poolLabel carried on the entry
    const redCant = sub(secs, "actions", "boons")!.entries[0];
    expect(redCant.kind).toBe("boon");
    if (redCant.kind !== "boon") throw new Error("expected boon");
    expect(redCant.status).toBe("selected");
    expect(redCant.poolLabel).toBe("Interdict Boons");

    const grant = sub(secs, "passive", "boons")!.entries.find(
      (e) => e.kind === "boon" && e.entry.entity.name === "Granted Gift",
    );
    expect(grant?.kind).toBe("boon");
    if (grant?.kind !== "boon") throw new Error("expected boon");
    expect(grant.status).toBe("granted");
  });

  it("skips buildOnly feats (pure ASI) and renderSuppressed features", () => {
    const secs = build({
      features: [
        feat("Ability Score Improvement", undefined, { kind: "feat", slug: "asi" }, { buildOnly: true }),
        feat("Suppressed Option", "action", { kind: "class", slug: "x", level: 1 }, { renderSuppressed: true }),
        feat("Grappler", "action", { kind: "feat", slug: "grappler" }),
      ],
    });
    // buildOnly ASI would have gone to Passive→Feats; renderSuppressed to Actions→Class features.
    expect(sub(secs, "passive", "feats")).toBeUndefined();
    expect(sub(secs, "actions", "class-features")).toBeUndefined();
    const g = sub(secs, "actions", "feats");
    expect(g).toBeDefined();
    expect(g!.entries).toHaveLength(1);
    const e = g!.entries[0];
    if (e.kind !== "feature") throw new Error("expected feature");
    expect(e.rf.feature.name).toBe("Grappler");
  });

  it("does NOT dedupe repeated features (multiclass/multi-level)", () => {
    const secs = build({
      features: [
        feat("Extra Attack", "special", { kind: "class", slug: "fighter", level: 5 }),
        feat("Extra Attack", "special", { kind: "class", slug: "ranger", level: 5 }),
      ],
    });
    const g = sub(secs, "passive", "class-features");
    expect(g!.entries).toHaveLength(2);
    expect(g!.entries.every((e) => e.kind === "feature" && e.rf.feature.name === "Extra Attack")).toBe(true);
  });

  it("omits an empty sub-group and a section whose sub-groups are all empty (all-ASI Feats → gone)", () => {
    // Two pure-ASI feats: both skipped → no entries at all → no sections.
    const allAsi = build({
      features: [
        feat("ASI 1", undefined, { kind: "feat", slug: "asi" }, { buildOnly: true }),
        feat("ASI 2", undefined, { kind: "feat", slug: "asi" }, { buildOnly: true }),
      ],
    });
    expect(allAsi).toEqual([]);

    // A lone passive race feature: only the Passive section, only the Race sub-group.
    const oneRace = build({
      features: [feat("Darkvision", undefined, { kind: "race", slug: "elf" })],
    });
    expect(oneRace.map((s) => s.key)).toEqual(["passive"]);
    expect(section(oneRace, "passive")!.subGroups.map((g) => g.key)).toEqual(["race"]);
  });

  it("keeps a single-source sub-group's head (DEC-F): Reactions with one Items row still has the Items subGroup", () => {
    const registry = buildMockRegistry([
      { slug: "srd-5e_ring-of-evasion", entityType: "item", data: { name: "Ring of Evasion" } },
    ]);
    const secs = build({
      equipment: [{ item: "[[srd-5e_ring-of-evasion]]", equipped: true }] as EquipmentEntry[],
      registry,
    });
    const r = section(secs, "reactions");
    expect(r).toBeDefined();
    expect(r!.subGroups).toHaveLength(1);
    // The head (key + label) is retained even as the section's only sub-group.
    expect(r!.subGroups[0].key).toBe("items");
    expect(r!.subGroups[0].label).toBe("Items");
    expect(r!.subGroups[0].entries).toHaveLength(1);
  });

  it("puts the ×N attacks · M equipped count on Actions → Weapons (attacksPerAction>1)", () => {
    const secs = build({
      attacks: [attack({ name: "Longsword" }), attack({ id: "atk2", name: "Longsword (offhand)" })],
      attacksPerAction: 2,
    });
    const g = sub(secs, "actions", "weapons");
    expect(g!.count).toBe("×2 attacks · 2 equipped");
  });

  it("drops the ×N clause when attacksPerAction <= 1 (or undefined), M still shown", () => {
    expect(sub(build({ attacks: [attack()], attacksPerAction: 1 }), "actions", "weapons")!.count)
      .toBe("1 equipped");
    // undefined attacksPerAction behaves as <=1
    expect(sub(build({ attacks: [attack(), attack({ id: "b" })] }), "actions", "weapons")!.count)
      .toBe("2 equipped");
  });

  it("M in the count is ALL equipped attacks, even when some weapons file into other economies", () => {
    const secs = build({
      attacks: [
        attack({ name: "Greatsword" }),                               // action → Actions/Weapons
        attack({ id: "b", name: "Handaxe", actionCost: "bonus-action" }), // bonus → Bonus/Weapons
      ],
      attacksPerAction: 2,
    });
    const aw = sub(secs, "actions", "weapons");
    expect(aw!.entries).toHaveLength(1);           // only the action-cost weapon lands here
    expect(aw!.count).toBe("×2 attacks · 2 equipped"); // M = derived.attacks.length (all equipped)
    const bw = sub(secs, "bonus", "weapons");
    expect(bw!.entries).toHaveLength(1);
    expect(bw!.count).toBeUndefined();
  });

  it("orders sections actions→bonus→reactions→passive and sub-groups in the fixed SourceKey order", () => {
    // Section order: one weapon per economy + a passive feature.
    const secOrder = build({
      attacks: [
        attack({ id: "c", name: "C" }),                                 // action
        attack({ id: "b", name: "B", actionCost: "bonus-action" }),     // bonus
        attack({ id: "a", name: "A", actionCost: "reaction" }),         // reaction
      ],
      features: [feat("Trait", "special", { kind: "class", slug: "c", level: 1 })], // passive
    });
    expect(secOrder.map((s) => s.key)).toEqual(["actions", "bonus", "reactions", "passive"]);

    // Sub-group order within ONE section (Passive) covering all 7 sources.
    // Deliberately inserted in a scrambled order (weapons→items→features→boons)
    // to prove the output is re-sorted into SOURCE_ORDER.
    const registry = buildMockRegistry([
      { slug: "srd-5e_special-trinket", entityType: "item", data: { name: "Special Trinket" } },
    ]);
    const srcOrder = build({
      attacks: [attack({ name: "Cursed Blade", actionCost: "special" })],  // → Passive/Weapons
      equipment: [
        { item: "[[srd-5e_special-trinket]]", equipped: true, overrides: { action: "special" } },
      ] as EquipmentEntry[],                                              // → Passive/Items
      features: [
        feat("Class Trait", "special", { kind: "class", slug: "c", level: 1 }),   // class-features
        feat("Feat Trait", "special", { kind: "feat", slug: "f" }),               // feats
        feat("Race Trait", undefined, { kind: "race", slug: "r" }),               // race
        feat("BG Trait", undefined, { kind: "background", slug: "b" }),           // background
      ],
      pools: [boonPool({ selected: [boonEntry("passive-boon", { name: "Passive Boon", passive: true })] })], // boons
      registry,
    });
    const passive = section(srcOrder, "passive");
    expect(passive).toBeDefined();
    expect(passive!.subGroups.map((g) => g.key)).toEqual([
      "weapons", "class-features", "items", "feats", "race", "background", "boons",
    ]);
  });
});
