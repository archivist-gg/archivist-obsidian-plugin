import { describe, it, expect } from "vitest";
import { castingTimeBadge, componentLetters, effectTags, groupByLevel, slotCells, hitDcDescriptor } from "../packages/obsidian/src/modules/pc/components/spells/spell-display";
import { bareEntitySlug } from "@archivist-gg/dnd5e/entities/slug";
import type { ResolvedSpell } from "@archivist-gg/dnd5e/pc/pc.types";

const sp = (over: Partial<ResolvedSpell["entity"]> & { name: string }, p: Partial<ResolvedSpell> = {}): ResolvedSpell =>
  ({ entity: over, slug: over.name.toLowerCase(), classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: false, ...p }) as ResolvedSpell;

describe("spell-display helpers", () => {
  it("castingTimeBadge maps casting_time tokens to {label,kind}", () => {
    expect(castingTimeBadge("action")).toEqual({ label: "Action", kind: "action" });
    expect(castingTimeBadge("bonus-action")).toEqual({ label: "Bonus", kind: "bonus" });
    expect(castingTimeBadge("reaction")).toEqual({ label: "Reaction", kind: "reaction" });
    expect(castingTimeBadge("1minute")).toEqual({ label: "1 min", kind: "time" });
    expect(castingTimeBadge("10minutes")).toEqual({ label: "10 min", kind: "time" });
    expect(castingTimeBadge(undefined)).toEqual({ label: "—", kind: "time" });
  });

  it("componentLetters splits the prose components string", () => {
    expect(componentLetters("V, S, M (a tiny ball of bat guano)")).toEqual({ letters: ["V", "S", "M"], material: true });
    expect(componentLetters("V, S")).toEqual({ letters: ["V", "S"], material: false });
    expect(componentLetters(undefined)).toEqual({ letters: [], material: false });
  });

  it("effectTags pulls save ability + damage types", () => {
    expect(effectTags(sp({ name: "Fireball", saving_throw: { ability: "dexterity" }, damage: { types: ["fire"] } }))).toEqual(["DEX save", "fire"]);
    expect(effectTags(sp({ name: "Mage Hand" }))).toEqual([]);
  });

  it("groupByLevel buckets spells, cantrips under 0", () => {
    const list = [sp({ name: "Fire Bolt", level: 0 }), sp({ name: "Shield", level: 1 }), sp({ name: "Fireball", level: 3 })];
    const g = groupByLevel(list);
    expect([...g.keys()]).toEqual([0, 1, 3]);
    expect(g.get(0)!.map((s) => s.entity.name)).toEqual(["Fire Bolt"]);
  });

  it("slotCells returns used/empty markers for a level", () => {
    expect(slotCells(3, 1)).toEqual([true, false, false]); // total 3, used 1 → [used, empty, empty]
  });
});

describe("hitDcDescriptor: attack-roll vs save vs neither", () => {
  // Real-shaped source-prefixed slugs so bareEntitySlug + the curated-set lookup
  // are exercised for real (not the bare test slug the sp() helper defaults to).
  const fireBolt = sp({ name: "Fire Bolt", level: 0, damage: { types: ["fire"] } }, { slug: "srd-2024_fire-bolt" });
  const magicMissile = sp({ name: "Magic Missile", level: 1, damage: { types: ["force"] } }, { slug: "srd-2024_magic-missile" });
  const fireball = sp({ name: "Fireball", level: 3, saving_throw: { ability: "dexterity" }, damage: { types: ["fire"] } }, { slug: "srd-2024_fireball" });

  it("shows an attack for a curated attack-roll spell (Fire Bolt), using the passed bonus", () => {
    expect(hitDcDescriptor(fireBolt, 0, 6)).toEqual({ kind: "attack", bonus: 6 });
  });

  it("returns null for Magic Missile: auto-hit, not curated, and no save", () => {
    expect(hitDcDescriptor(magicMissile, 0, 6)).toBeNull();
  });

  it("still shows a save for Fireball, which has a saving throw", () => {
    expect(hitDcDescriptor(fireball, 15, 6)).toMatchObject({ kind: "save", ability: "DEX", dc: 15 });
  });

  it("attack bonus defaults to 0 when no bonus is passed", () => {
    expect(hitDcDescriptor(fireBolt, 0)).toEqual({ kind: "attack", bonus: 0 });
  });

  it("bareEntitySlug strips the source prefix so the curated set is edition-agnostic", () => {
    expect(bareEntitySlug("srd-2024_fire-bolt")).toBe("fire-bolt");
  });
});
