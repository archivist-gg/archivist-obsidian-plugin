import { describe, it, expect } from "vitest";
import { collectResolvedFeatures } from "@archivist/dnd5e/pc/pc.resolver";
import { seedFeatureUses } from "../packages/obsidian/src/modules/pc/pc.resource-seed";
import type { ResolvedCharacter, DerivedStats } from "@archivist/dnd5e/pc/pc.types";

function derived(): DerivedStats {
  return { proficiencyBonus: 3, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 4 } } as unknown as DerivedStats;
}

type Classes = Parameters<typeof collectResolvedFeatures>[1];

const classes = [{
  entity: { slug: "reaver", name: "Reaver", features_by_level: {}, resources: [{ id: "reaver:seals", name: "Seals", max_formula: "3", reset: "long-rest" }] },
  level: 5,
  subclass: { slug: "architect-of-ruin", name: "Architect of Ruin", features_by_level: {}, resources: [{ id: "reaver:conduit", name: "Conduit", max_formula: "2", reset: "short-rest" }] },
  choices: {},
}] as unknown as Classes;

describe("collectResolvedFeatures — entity-level resources", () => {
  it("surfaces entity-level class resources as a resolved feature", () => {
    const feats = collectResolvedFeatures(null, classes, null, []);
    const seals = feats.find((f) => f.feature.resources?.some((r) => r.id === "reaver:seals"));
    expect(seals).toBeTruthy();
    expect(seals!.source).toEqual({ kind: "class", slug: "reaver", level: 1 });
  });

  it("surfaces entity-level subclass resources as a resolved feature", () => {
    const feats = collectResolvedFeatures(null, classes, null, []);
    const conduit = feats.find((f) => f.feature.resources?.some((r) => r.id === "reaver:conduit"));
    expect(conduit).toBeTruthy();
    expect(conduit!.source).toEqual({ kind: "subclass", slug: "architect-of-ruin", level: 1 });
  });

  it("entity-level resources seed into feature_uses end-to-end", () => {
    const features = collectResolvedFeatures(null, classes, null, []);
    const r = { totalLevel: 5, classes, features, state: { feature_uses: {} } } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["reaver:seals"].max).toBe(3);
    expect(r.state.feature_uses["reaver:conduit"].max).toBe(2);
  });

  it("same-id class + subclass resources merge by max()", () => {
    const cls = [{
      entity: { slug: "c", name: "C", features_by_level: {}, resources: [{ id: "shared", name: "Shared", max_formula: "2", reset: "long-rest" }] },
      level: 5,
      subclass: { slug: "s", name: "S", features_by_level: {}, resources: [{ id: "shared", name: "Shared", max_formula: "5", reset: "long-rest" }] },
      choices: {},
    }] as unknown as Classes;
    const features = collectResolvedFeatures(null, cls, null, []);
    const r = { totalLevel: 5, classes: cls, features, state: { feature_uses: {} } } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["shared"].max).toBe(5);
  });

  it("a class with no entity-level resources adds no synthesized feature", () => {
    const cls = [{ entity: { slug: "fighter", name: "Fighter", features_by_level: {}, resources: [] }, level: 5, choices: {} }] as unknown as Classes;
    const feats = collectResolvedFeatures(null, cls, null, []);
    expect(feats.length).toBe(0);
  });

  it("entity-level resource max_formula binds class_level to the owning class (source level:1 is harmless)", () => {
    const cls = [{
      entity: { slug: "reaver", name: "Reaver", features_by_level: {}, resources: [{ id: "reaver:scaled", name: "Scaled", max_formula: "class_level", reset: "long-rest" }] },
      level: 5,
      choices: {},
    }] as unknown as Classes;
    const features = collectResolvedFeatures(null, cls, null, []);
    const r = { totalLevel: 5, classes: cls, features, state: { feature_uses: {} } } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["reaver:scaled"].max).toBe(5); // owning class level, not source.level (1)
  });

  it("entity-level resources are additive to feature-level resources of a different id", () => {
    const cls = [{
      entity: {
        slug: "reaver", name: "Reaver",
        features_by_level: { 1: [{ name: "Blood Price", resources: [{ id: "reaver:hit-dice", name: "Hit Dice", max_formula: "2", reset: "long-rest" }] }] },
        resources: [{ id: "reaver:seals", name: "Seals", max_formula: "3", reset: "long-rest" }],
      },
      level: 5,
      choices: {},
    }] as unknown as Classes;
    const features = collectResolvedFeatures(null, cls, null, []);
    const r = { totalLevel: 5, classes: cls, features, state: { feature_uses: {} } } as unknown as ResolvedCharacter;
    seedFeatureUses(r, derived());
    expect(r.state.feature_uses["reaver:seals"].max).toBe(3);
    expect(r.state.feature_uses["reaver:hit-dice"].max).toBe(2);
  });
});
