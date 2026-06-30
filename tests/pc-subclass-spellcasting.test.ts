import { describe, it, expect } from "vitest";
import { subclassEntitySchema } from "@archivist/dnd5e/subclass/subclass.schema";
import { recalc } from "../packages/obsidian/src/modules/pc/pc.recalc";
import type { ResolvedCharacter, ResolvedClass } from "../packages/obsidian/src/modules/pc/pc.types";

describe("subclass schema — spellcasting", () => {
  it("accepts a third-caster subclass with a known/cantrip table", () => {
    const parsed = subclassEntitySchema.safeParse({
      slug: "architect-of-ruin",
      name: "Architect of Ruin",
      parent_class: "[[reaver]]",
      edition: "2014",
      source: "Reaver Revised",
      description: "x",
      features_by_level: {},
      resources: [],
      spellcasting: {
        caster_type: "third",
        ability: "cha",
        preparation: "known",
        spell_list: "architect-of-ruin",
      },
      table: { "3": { columns: { "Cantrips Known": 2, "Spells Known": 3 } } },
    });
    expect(parsed.success).toBe(true);
  });
});

function architect(level: number): ResolvedClass {
  return {
    entity: { slug: "reaver", name: "Reaver", edition: "2014", hit_die: "d10",
      primary_abilities: [], saving_throws: [], features_by_level: {}, table: {}, spellcasting: null } as never,
    level,
    subclass: { slug: "architect-of-ruin", name: "Architect of Ruin",
      spellcasting: { caster_type: "third", ability: "cha", preparation: "known", spell_list: "architect-of-ruin" },
      table: { 3: { columns: { "Cantrips Known": 2, "Spells Known": 3 } },
               20: { columns: { "Cantrips Known": 3, "Spells Known": 13 } } },
      features_by_level: {}, resources: [] } as never,
    choices: {},
  };
}

function wrap(classes: ResolvedClass[], scores: Record<string, number>): ResolvedCharacter {
  const def = { name: "T", edition: "2014" as const, race: null, subrace: null, background: null,
    class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...scores }, ability_method: "manual" as const,
    skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] }, equipment: [], overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], exhaustion: 0, inspiration: 0, feature_uses: {} } };
  return { definition: def as never, race: null, classes, background: null, feats: [],
    totalLevel: classes.reduce((s, c) => s + c.level, 0), features: [], spells: [], state: def.state as never };
}

describe("Architect of Ruin — subclass spellcasting (engine, via recalc)", () => {
  it("L3 → Cha caster, dedicated third-caster slots, known/cantrips from the subclass table", () => {
    const d = recalc(wrap([architect(3)], { cha: 16 }));
    expect(d.spellcastingClasses[0].ability).toBe("cha");
    expect(d.spellcastingClasses[0].casterType).toBe("third");
    expect(d.spellcastingClasses[0].saveDC).toBe(8 + 2 + 3); // prof +2 @ L3, CHA +3
    expect(d.derivedSpellSlots).toEqual({ 1: 2 });
    const lim = d.spellLimits[0];
    expect(lim.cantripsKnown).toBe(2);
    expect(lim.preparedOrKnown).toBe(3);
  });

  it("L20 → full third-caster slot table + L20 known/cantrips from the subclass table", () => {
    const d = recalc(wrap([architect(20)], { cha: 20 }));
    expect(d.derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 1 });
    expect(d.spellLimits[0].cantripsKnown).toBe(3);
    expect(d.spellLimits[0].preparedOrKnown).toBe(13);
  });

  it("multiclass: Architect(reaver) 9 + Wizard 6 → combined caster level 9 via thirds", () => {
    const wiz: ResolvedClass = { entity: { slug: "wizard", name: "Wizard", edition: "2014", hit_die: "d6",
      primary_abilities: [], saving_throws: [], features_by_level: {}, table: {},
      spellcasting: { caster_type: "full", ability: "int", preparation: "prepared", spell_list: "wizard" } } as never,
      level: 6, subclass: null, choices: {} };
    const d = recalc(wrap([architect(9), wiz], { cha: 16, int: 16 }));
    // caster level = 6 (full) + floor(9/3)=3 → 9 → FULL_CASTER_SLOTS row 9 = [4,3,3,3,1]
    expect(d.derivedSpellSlots).toEqual({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 });
  });
});
