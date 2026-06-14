import { describe, it, expect } from "vitest";
import { resolveSpellcasting } from "../src/modules/pc/pc.spellcasting";
import type { ResolvedClass } from "../src/modules/pc/pc.types";

// Minimal ResolvedClass builder; only the fields resolveSpellcasting reads matter.
const rc = (over: Record<string, unknown>): ResolvedClass =>
  ({ entity: null, subclass: null, level: 1, choices: {}, ...over } as unknown as ResolvedClass);

describe("resolveSpellcasting", () => {
  it("reads the class spellcasting block + class table (Wizard → INT/full/prepared)", () => {
    const p = resolveSpellcasting(rc({
      entity: { slug: "wizard", spellcasting: { caster_type: "full", ability: "int", preparation: "prepared", spell_list: "wizard" }, table: { 1: { columns: { "Cantrips Known": 3 } } } },
    }));
    expect(p).toEqual({ ability: "int", casterType: "full", preparation: "prepared", spellList: "wizard", table: { 1: { columns: { "Cantrips Known": 3 } } } });
  });

  it("returns null when neither class nor subclass grants casting", () => {
    expect(resolveSpellcasting(rc({ entity: { slug: "fighter", spellcasting: null, table: {} } }))).toBeNull();
    expect(resolveSpellcasting(rc({}))).toBeNull();
  });

  it("uses the subclass block + subclass table when the subclass grants casting (Architect of Ruin)", () => {
    const p = resolveSpellcasting(rc({
      entity: { slug: "reaver", spellcasting: null, table: {} },
      subclass: { slug: "architect-of-ruin", spellcasting: { caster_type: "third", ability: "cha", preparation: "known", spell_list: "architect-of-ruin" }, table: { 3: { columns: { "Spells Known": 3 } } } },
    }));
    expect(p?.casterType).toBe("third");
    expect(p?.ability).toBe("cha");
    expect(p?.spellList).toBe("architect-of-ruin");
    expect(p?.table).toEqual({ 3: { columns: { "Spells Known": 3 } } });
  });

  it("subclass casting overrides the class block when both exist", () => {
    const p = resolveSpellcasting(rc({
      entity: { slug: "wizard", spellcasting: { caster_type: "full", ability: "int", preparation: "prepared", spell_list: "wizard" }, table: { 1: { columns: {} } } },
      subclass: { slug: "x", spellcasting: { caster_type: "third", ability: "cha", preparation: "known", spell_list: "x" }, table: { 3: { columns: { "Spells Known": 2 } } } },
    }));
    expect(p?.casterType).toBe("third");
    expect(p?.spellList).toBe("x");
  });

  it("subclass grants casting but has no table → falls back to the class table", () => {
    const p = resolveSpellcasting(rc({
      entity: { slug: "reaver", spellcasting: null, table: { 3: { columns: { "Cantrips Known": 2 } } } },
      subclass: { slug: "architect-of-ruin", spellcasting: { caster_type: "third", ability: "cha", preparation: "known", spell_list: "aor" } },
    }));
    expect(p?.table).toEqual({ 3: { columns: { "Cantrips Known": 2 } } });
  });
});
