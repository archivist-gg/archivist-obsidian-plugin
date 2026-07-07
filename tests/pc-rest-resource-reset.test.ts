import { describe, it, expect } from "vitest";
import { computeRestPlan } from "@archivist/dnd5e/pc/pc.rest";
import { applyRestResets } from "../packages/obsidian/src/modules/pc/pc.rest";
import type { Character, ResolvedCharacter, DerivedStats } from "@archivist/dnd5e/pc/pc.types";

function feat(id: string, name: string, reset: string) {
  return { feature: { name, resources: [{ id, name, max_formula: "1", reset }] }, source: { kind: "class", slug: "x", level: 1 } };
}

function setup(featureUses: Record<string, { used: number; max: number }>, features: object[]) {
  const character = {
    equipment: [],
    state: {
      hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {},
      concentration: null, conditions: [], exhaustion: 0, inspiration: 0,
      feature_uses: featureUses,
    },
  } as unknown as Character;
  const resolved = { totalLevel: 5, features } as unknown as ResolvedCharacter;
  const derived = { hp: { max: 10 } } as unknown as DerivedStats;
  return { character, resolved, derived };
}

describe("rest resets feature resources", () => {
  it("long rest clears short, long, dawn and dusk resets", () => {
    const { character, resolved, derived } = setup(
      { s: { used: 1, max: 1 }, l: { used: 1, max: 1 }, dawn: { used: 1, max: 1 }, dusk: { used: 1, max: 1 }, turn: { used: 1, max: 1 } },
      [feat("s", "S", "short-rest"), feat("l", "L", "long-rest"), feat("dawn", "Dawn", "dawn"), feat("dusk", "Dusk", "dusk"), feat("turn", "Turn", "turn")],
    );
    const plan = computeRestPlan(character, resolved, derived, null, "long");
    applyRestResets(character, resolved, derived, plan, new Set());
    expect(character.state.feature_uses.s.used).toBe(0);
    expect(character.state.feature_uses.l.used).toBe(0);
    expect(character.state.feature_uses.dawn.used).toBe(0);
    expect(character.state.feature_uses.dusk.used).toBe(0);
    expect(character.state.feature_uses.turn.used).toBe(1);   // encounter-scoped: untouched
  });

  it("short rest clears only short-rest resets", () => {
    const { character, resolved, derived } = setup(
      { s: { used: 1, max: 1 }, l: { used: 1, max: 1 } },
      [feat("s", "S", "short-rest"), feat("l", "L", "long-rest")],
    );
    const plan = computeRestPlan(character, resolved, derived, null, "short");
    applyRestResets(character, resolved, derived, plan, new Set());
    expect(character.state.feature_uses.s.used).toBe(0);
    expect(character.state.feature_uses.l.used).toBe(1);
  });

  it("resets every resource of a multi-resource feature", () => {
    const multi = { feature: { name: "Multi", resources: [
      { id: "a", name: "A", max_formula: "1", reset: "short-rest" },
      { id: "b", name: "B", max_formula: "1", reset: "short-rest" },
    ] }, source: { kind: "class", slug: "x", level: 1 } };
    const { character, resolved, derived } = setup({ a: { used: 1, max: 1 }, b: { used: 1, max: 1 } }, [multi]);
    const plan = computeRestPlan(character, resolved, derived, null, "short");
    applyRestResets(character, resolved, derived, plan, new Set());
    expect(character.state.feature_uses.a.used).toBe(0);
    expect(character.state.feature_uses.b.used).toBe(0);
  });

  it("an orphaned feature_uses id (no matching resource) defaults to long-rest reset", () => {
    // long rest clears it (default "long-rest")
    {
      const { character, resolved, derived } = setup({ orphan: { used: 1, max: 1 } }, []);
      const plan = computeRestPlan(character, resolved, derived, null, "long");
      applyRestResets(character, resolved, derived, plan, new Set());
      expect(character.state.feature_uses.orphan.used).toBe(0);
    }
    // short rest leaves it (default "long-rest" is not short-rest)
    {
      const { character, resolved, derived } = setup({ orphan: { used: 1, max: 1 } }, []);
      const plan = computeRestPlan(character, resolved, derived, null, "short");
      applyRestResets(character, resolved, derived, plan, new Set());
      expect(character.state.feature_uses.orphan.used).toBe(1);
    }
  });

  it("a short-rest resource resets on BOTH a short and a long rest (§6.4)", () => {
    // long rest
    {
      const { character, resolved, derived } = setup({ s: { used: 1, max: 1 } }, [feat("s", "S", "short-rest")]);
      const plan = computeRestPlan(character, resolved, derived, null, "long");
      applyRestResets(character, resolved, derived, plan, new Set());
      expect(character.state.feature_uses.s.used).toBe(0);
    }
    // short rest
    {
      const { character, resolved, derived } = setup({ s: { used: 1, max: 1 } }, [feat("s", "S", "short-rest")]);
      const plan = computeRestPlan(character, resolved, derived, null, "short");
      applyRestResets(character, resolved, derived, plan, new Set());
      expect(character.state.feature_uses.s.used).toBe(0);
    }
  });
});
