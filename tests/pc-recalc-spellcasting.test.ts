import { describe, it, expect } from "vitest";
import { recalc } from "../src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass } from "../src/modules/pc/pc.types";

function mkCaster(slug: string, level: number, extra: Record<string, unknown> = {}): ResolvedClass {
  return {
    entity: { slug, name: slug, edition: "2014", hit_die: "d6", primary_abilities: [], saving_throws: [], features_by_level: {}, table: {}, ...extra } as never,
    level, subclass: null, choices: {},
  };
}
function resolvedWith(classes: ResolvedClass[], scores: Record<string, number>): ResolvedCharacter {
  const def = {
    name: "T", edition: "2014" as const, race: null, subrace: null, background: null,
    class: classes.map((c) => ({ name: c.entity!.slug, level: c.level, subclass: null, choices: {} })),
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores },
    ability_method: "manual" as const, skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] }, equipment: [], overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} },
  };
  return { definition: def as never, race: null, classes, background: null, feats: [], totalLevel: classes.reduce((s, c) => s + c.level, 0), features: [], state: def.state as never };
}

describe("recalc — spellcasting", () => {
  it("computes per-class DC/attack for a single Wizard 5 (INT 16)", () => {
    const d = recalc(resolvedWith([mkCaster("wizard", 5)], { int: 16 }));
    expect(d.spellcastingClasses).toHaveLength(1);
    const w = d.spellcastingClasses[0];
    expect(w.ability).toBe("int");
    expect(w.saveDC).toBe(8 + 3 + 3);       // prof 3 (lvl5), INT mod +3
    expect(w.attackBonus).toBe(3 + 3);
    expect(d.derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 2 });
    expect(d.pactMagic).toBeNull();
  });

  it("multiclass: Cleric 3 (WIS 14) / Wizard 2 (INT 16) → two entries + combined slots", () => {
    const d = recalc(resolvedWith([mkCaster("cleric", 3), mkCaster("wizard", 2)], { wis: 14, int: 16 }));
    expect(d.spellcastingClasses.map((s) => s.classSlug).sort()).toEqual(["cleric", "wizard"]);
    expect(d.derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 2 }); // caster level 5
  });

  it("warlock produces pactMagic and no standard slots", () => {
    const d = recalc(resolvedWith([mkCaster("warlock", 5)], { cha: 16 }));
    expect(d.pactMagic).toEqual({ level: 3, total: 2 });
    expect(d.derivedSpellSlots).toEqual({});
  });

  it("non-caster: empty spellcastingClasses", () => {
    const d = recalc(resolvedWith([mkCaster("fighter", 5)], {}));
    expect(d.spellcastingClasses).toEqual([]);
    expect(d.spellcasting).toBeNull();
  });
});
