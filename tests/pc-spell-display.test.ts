import { describe, it, expect } from "vitest";
import { castingTimeBadge, componentLetters, effectTags, groupByLevel, slotCells } from "../src/modules/pc/components/spells/spell-display";
import type { ResolvedSpell } from "../src/modules/pc/pc.types";

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
