import { describe, it, expect } from "vitest";
import { preparedWarnings } from "../packages/obsidian/src/modules/pc/components/spells/spell-display";
import type { ResolvedSpell, SpellLimitInfo } from "../packages/obsidian/src/modules/pc/pc.types";

const sp = (slug: string, classSlug: string, prepared: boolean, level = 1): ResolvedSpell =>
  ({ entity: { name: slug, level }, slug, classSlug, source: "class", prepared, alwaysPrepared: false }) as ResolvedSpell;

describe("preparedWarnings", () => {
  it("warns when prepared count exceeds the limit for a class", () => {
    const limits: SpellLimitInfo[] = [{ classSlug: "wizard", kind: "prepared", cantripsKnown: 4, preparedOrKnown: 2 }];
    const spells = [sp("a", "wizard", true), sp("b", "wizard", true), sp("c", "wizard", true)]; // 3 prepared, limit 2
    const w = preparedWarnings(spells, limits);
    expect(w).toEqual(["wizard: 3/2 prepared"]);
  });

  it("no warning at or under the limit", () => {
    const limits: SpellLimitInfo[] = [{ classSlug: "wizard", kind: "prepared", cantripsKnown: 4, preparedOrKnown: 5 }];
    expect(preparedWarnings([sp("a", "wizard", true)], limits)).toEqual([]);
  });

  it("ignores cantrips and always-prepared in the prepared count", () => {
    const limits: SpellLimitInfo[] = [{ classSlug: "wizard", kind: "prepared", cantripsKnown: 4, preparedOrKnown: 1 }];
    const spells = [sp("cantrip", "wizard", true, 0), { ...sp("dom", "wizard", true), alwaysPrepared: true }, sp("real", "wizard", true)];
    expect(preparedWarnings(spells, limits)).toEqual([]); // only 1 counts, limit 1
  });
});
