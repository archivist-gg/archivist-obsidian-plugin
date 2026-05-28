// tests/pc-recalc-proficiency.test.ts

import { describe, it, expect } from "vitest";
import { computeProficiencies } from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter } from "../src/modules/pc/pc.types";

function makeResolved(overrides: Partial<ResolvedCharacter>): ResolvedCharacter {
  return {
    definition: {} as ResolvedCharacter["definition"],
    race: null,
    classes: [],
    background: null,
    feats: [],
    totalLevel: 1,
    features: [],
    state: {} as ResolvedCharacter["state"],
    ...overrides,
  } as ResolvedCharacter;
}

describe("computeProficiencies", () => {
  it("aggregates from a single class", () => {
    const resolved = makeResolved({
      classes: [
        {
          entity: {
            proficiencies: {
              armor: { categories: ["light", "medium"] },
              weapons: { categories: ["simple", "martial"] },
              tools: { specific: ["thieves-tools"] },
              languages: ["common"],
            },
          } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
      ],
    });
    const p = computeProficiencies(resolved);
    expect(p.armor.categories).toEqual(["light", "medium"]);
    expect(p.weapons.categories).toEqual(["simple", "martial"]);
    expect(p.tools.specific).toEqual(["thieves-tools"]);
    expect(p.languages).toEqual(["common"]);
  });

  it("merges proficiencies from multiple classes (multiclass)", () => {
    const resolved = makeResolved({
      classes: [
        {
          entity: { proficiencies: { weapons: { categories: ["simple"] } } } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
        {
          entity: { proficiencies: { weapons: { categories: ["martial"] } } } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
      ],
    });
    const p = computeProficiencies(resolved);
    expect(p.weapons.categories).toContain("simple");
    expect(p.weapons.categories).toContain("martial");
  });

  it("dedupes overlapping proficiencies", () => {
    const resolved = makeResolved({
      classes: [
        {
          entity: { proficiencies: { weapons: { categories: ["simple"] }, languages: ["common"] } } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
        {
          entity: { proficiencies: { weapons: { categories: ["simple"] }, languages: ["common"] } } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
      ],
    });
    const p = computeProficiencies(resolved);
    expect(p.weapons.categories).toEqual(["simple"]);
    expect(p.languages).toEqual(["common"]);
  });

  it("handles legacy array shape for proficiencies", () => {
    const resolved = makeResolved({
      classes: [
        {
          entity: { proficiencies: { armor: ["shield"] as never } } as never,
          level: 1,
          subclass: null,
          choices: {},
        },
      ],
    });
    const p = computeProficiencies(resolved);
    expect(p.armor.specific).toEqual(["shield"]);
  });

  it("merges from race + background + feats", () => {
    const resolved = makeResolved({
      race: { proficiencies: { weapons: { specific: ["longsword"] } } } as never,
      background: { proficiencies: { tools: { specific: ["disguise-kit"] } } } as never,
      feats: [
        { grants_proficiency: { weapons: { specific: ["longbow"] } } } as never,
      ],
    });
    const p = computeProficiencies(resolved);
    expect(p.weapons.specific).toContain("longsword");
    expect(p.weapons.specific).toContain("longbow");
    expect(p.tools.specific).toContain("disguise-kit");
  });
});
