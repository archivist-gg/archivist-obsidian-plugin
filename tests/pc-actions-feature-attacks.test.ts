import { describe, it, expect } from "vitest";
import { collectFeatureAttacks } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

function resolved(features: object[], totalLevel: number): ResolvedCharacter {
  return { totalLevel, features } as unknown as ResolvedCharacter;
}

describe("collectFeatureAttacks — scaling-die damage", () => {
  it("uses the feature's scaling die as damage when the attack omits its own", () => {
    const r = resolved([{
      feature: {
        name: "Baleful Interdict",
        resources: [{ id: "reaver:seal-damage", name: "Seal Damage", max_formula: "1", reset: "long-rest", die: { base: "d6", scaling: { "5": "d8", "11": "d10" } } }],
        attacks: [{ name: "Seal", to_hit: "+7" }],
      },
      source: { kind: "class", slug: "reaver", level: 1 },
    }], 11);
    expect(collectFeatureAttacks(r)[0].damage).toBe("d10");
  });

  it("static attack damage always wins over the scaling die", () => {
    const r = resolved([{
      feature: {
        name: "X",
        resources: [{ id: "x", name: "X", max_formula: "1", reset: "long-rest", die: { base: "d6", scaling: { "5": "d8" } } }],
        attacks: [{ name: "Hit", damage: "2d6 fire" }],
      },
      source: { kind: "class", slug: "x", level: 1 },
    }], 11);
    expect(collectFeatureAttacks(r)[0].damage).toBe("2d6 fire");
  });

  it("no resource die → damage stays undefined", () => {
    const r = resolved([{
      feature: { name: "Y", attacks: [{ name: "Plain" }] },
      source: { kind: "class", slug: "y", level: 1 },
    }], 11);
    expect(collectFeatureAttacks(r)[0].damage).toBeUndefined();
  });

  it("skips resources without a die to the first die-bearing one", () => {
    const r = resolved([{
      feature: {
        name: "Multi",
        resources: [
          { id: "a", name: "A", max_formula: "1", reset: "long-rest" },
          { id: "b", name: "B", max_formula: "1", reset: "long-rest", die: { base: "d4", scaling: { "5": "d6" } } },
        ],
        attacks: [{ name: "Hit" }],
      },
      source: { kind: "class", slug: "x", level: 1 },
    }], 5);
    expect(collectFeatureAttacks(r)[0].damage).toBe("d6");
  });

  it("applies the scaling die to every damage-less attack on the feature", () => {
    const r = resolved([{
      feature: {
        name: "Two Attacks",
        resources: [{ id: "d", name: "D", max_formula: "1", reset: "long-rest", die: { base: "d8" } }],
        attacks: [{ name: "First" }, { name: "Second" }],
      },
      source: { kind: "class", slug: "x", level: 3 },
    }], 3);
    const out = collectFeatureAttacks(r);
    expect(out[0].damage).toBe("d8");
    expect(out[1].damage).toBe("d8");
  });
});
