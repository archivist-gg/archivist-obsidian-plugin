import { describe, it, expect } from "vitest";
import { applySpellFilter, type SpellFilter } from "../src/modules/pc/components/spells/table-view";
import type { ResolvedSpell } from "../src/modules/pc/pc.types";

const sp = (name: string, level: number, opts: Partial<ResolvedSpell["entity"]> = {}, prepared = false): ResolvedSpell =>
  ({ entity: { name, level, ...opts }, slug: name.toLowerCase(), classSlug: "wizard", source: "class", prepared, alwaysPrepared: false }) as ResolvedSpell;

const LIST = [
  sp("Fire Bolt", 0),
  sp("Shield", 1, {}, true),
  sp("Detect Magic", 1, { ritual: true }),
  sp("Haste", 3, { concentration: true }, true),
];

describe("applySpellFilter", () => {
  it("'all' returns everything", () => expect(applySpellFilter(LIST, "all").length).toBe(4));
  it("'prepared' returns only prepared", () => expect(applySpellFilter(LIST, "prepared").map((s) => s.entity.name)).toEqual(["Shield", "Haste"]));
  it("'cantrips' returns level 0", () => expect(applySpellFilter(LIST, "cantrips").map((s) => s.entity.name)).toEqual(["Fire Bolt"]));
  it("'ritual' returns ritual spells", () => expect(applySpellFilter(LIST, "ritual").map((s) => s.entity.name)).toEqual(["Detect Magic"]));
  it("'concentration' returns concentration spells", () => expect(applySpellFilter(LIST, "concentration").map((s) => s.entity.name)).toEqual(["Haste"]));
});
