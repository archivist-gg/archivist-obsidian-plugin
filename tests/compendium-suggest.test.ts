import { describe, it, expect, vi } from "vitest";
import { detectCompendiumTrigger, adjustEndForBracketMatch } from "../packages/obsidian/src/shared/extensions/compendium-suggest";
import { CompendiumEditorSuggest } from "../packages/obsidian/src/shared/extensions/compendium-suggest";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { EditorSuggestContext } from "obsidian";
import type { RegisteredEntity } from "@archivist-gg/core";

describe("compendium suggest trigger detection", () => {
  it("triggers on {{ with bracket matching (cursor between {{ and }})", () => {
    const result = detectCompendiumTrigger("{{}}", 2);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("");
  });

  it("triggers while typing query with bracket matching", () => {
    const result = detectCompendiumTrigger("{{m}}", 3);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("m");
  });

  it("triggers with type prefix and bracket matching", () => {
    const result = detectCompendiumTrigger("{{monster:gob}}", 13);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });

  it("does not trigger when cursor is after a completed reference", () => {
    const result = detectCompendiumTrigger("{{monster:goblin}}", 18);
    expect(result).toBeNull();
  });

  it("does not trigger with no {{ present", () => {
    const result = detectCompendiumTrigger("some text", 5);
    expect(result).toBeNull();
  });

  it("triggers on second reference when first is completed", () => {
    const result = detectCompendiumTrigger("{{monster:goblin}} text {{sp}}", 28);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("sp");
  });

  it("triggers on {{ without bracket matching", () => {
    const result = detectCompendiumTrigger("{{monster:gob", 13);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });
});

describe("adjustEndForBracketMatch", () => {
  it("consumes }} when present at endCh", () => {
    const result = adjustEndForBracketMatch("{{monster:gob}}", 13);
    expect(result).toBe(15);
  });

  it("returns endCh unchanged when no }} follows", () => {
    const result = adjustEndForBracketMatch("{{monster:gob", 13);
    expect(result).toBe(13);
  });

  it("returns endCh unchanged when only single } follows", () => {
    const result = adjustEndForBracketMatch("{{monster:gob} text", 13);
    expect(result).toBe(13);
  });
});

describe("getSuggestions compendium visibility (F9)", () => {
  function mkSuggest(entries: Parameters<typeof buildMockRegistry>[0], hidden: string[]) {
    return new CompendiumEditorSuggest({} as never, buildMockRegistry(entries), () => new Set(hidden));
  }
  const ctxFor = (query: string) => ({ query }) as EditorSuggestContext;

  it("drops hidden-compendium entities and keeps visible ones", () => {
    const s = mkSuggest([
      { slug: "srd-5e_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "SRD 5e" },
      { slug: "srd-2024_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "SRD 2024" },
    ], ["SRD 5e"]);
    expect(s.getSuggestions(ctxFor("fire")).map((e) => e.slug)).toEqual(["srd-2024_spell_fireball"]);
  });

  it("caps at 20 AFTER filtering: hidden matches never starve visible ones", () => {
    const entries = [];
    for (let i = 0; i < 25; i++) {
      entries.push({ slug: `h_spell_a${i}`, name: `Aspell ${i}`, entityType: "spell", data: {}, compendium: "Hidden HB" });
      entries.push({ slug: `v_spell_b${i}`, name: `Aspell z${i}`, entityType: "spell", data: {}, compendium: "Visible HB" });
    }
    const out = mkSuggest(entries, ["Hidden HB"]).getSuggestions(ctxFor("aspell"));
    expect(out.length).toBe(20);
    expect(out.every((e) => e.compendium === "Visible HB")).toBe(true);
  });

  it("empty hidden set returns everything (fail-open path)", () => {
    const s = mkSuggest([
      { slug: "srd-5e_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "SRD 5e" },
    ], []);
    expect(s.getSuggestions(ctxFor("fire")).length).toBe(1);
  });
});

describe("getSuggestions untyped path is BOUNDED (spec §8.3)", () => {
  const ctxFor = (query: string) => ({ query }) as EditorSuggestContext;
  const entries = [
    { slug: "srd_spell_fire", name: "Fire", entityType: "spell", data: {}, compendium: "SRD 5e" },
    { slug: "srd_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "SRD 5e" },
    { slug: "srd_item_fire-oil", name: "Wall of Fire Oil", entityType: "item", data: {}, compendium: "SRD 5e" },
    { slug: "hb_spell_firebolt", name: "Firebolt", entityType: "spell", data: {}, compendium: "Hidden HB" },
  ];

  /** THE NO-OP KILLER. A "bounded" helper written on top of
   *  `registry.search(q, undefined, Infinity)` still sorts the whole pool, so it
   *  changes nothing. The untyped path must walk `getAllSlugs()`/`getBySlug()`
   *  and call `search` ZERO times. */
  it("performs ZERO registry.search calls on an untyped query", () => {
    const reg = buildMockRegistry(entries);
    const spy = vi.spyOn(reg, "search");
    const s = new CompendiumEditorSuggest({} as never, reg, () => new Set(["Hidden HB"]));

    const out = s.getSuggestions(ctxFor("fire"));

    expect(spy).toHaveBeenCalledTimes(0);
    expect(out.map((e) => e.slug)).toEqual([
      "srd_spell_fire",
      "srd_spell_fireball",
      "srd_item_fire-oil",
    ]);
  });

  it("performs ZERO registry.search calls on an EMPTY untyped query", () => {
    const reg = buildMockRegistry(entries);
    const spy = vi.spyOn(reg, "search");
    new CompendiumEditorSuggest({} as never, reg, () => new Set()).getSuggestions(ctxFor(""));
    expect(spy).toHaveBeenCalledTimes(0);
  });

  /** An UNRECOGNISED prefix resolves to no entity type, so it is an untyped
   *  query too — it must take the bounded path, not fall back to `search`. */
  it("an unknown type prefix is still the untyped path (zero search calls)", () => {
    const reg = buildMockRegistry(entries);
    const spy = vi.spyOn(reg, "search");
    const out = new CompendiumEditorSuggest({} as never, reg, () => new Set()).getSuggestions(
      ctxFor("bogus:fire"),
    );
    expect(spy).toHaveBeenCalledTimes(0);
    expect(out.map((e) => e.slug)).toEqual([
      "srd_spell_fire",
      "srd_spell_fireball",
      "hb_spell_firebolt",
      "srd_item_fire-oil",
    ]);
  });

  it("the TYPED path is unchanged and still uses registry.search", () => {
    const reg = buildMockRegistry(entries);
    const spy = vi.spyOn(reg, "search");
    const out = new CompendiumEditorSuggest({} as never, reg, () => new Set(["Hidden HB"])).getSuggestions(
      ctxFor("spell:fire"),
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("fire", "spell", Number.POSITIVE_INFINITY);
    expect(out.map((e) => e.slug)).toEqual(["srd_spell_fire", "srd_spell_fireball"]);
  });

  /** The pool order the bounded walk must preserve is `getAllSlugs()` order.
   *  Two entities that COLLIDE on name make that observable: a walk over a
   *  sorted copy of the slug set would put "a_" first. */
  it("duplicated names keep REGISTRATION order, not slug order", () => {
    const reg = buildMockRegistry([
      { slug: "z_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "Z" },
      { slug: "a_spell_fireball", name: "Fireball", entityType: "spell", data: {}, compendium: "A" },
    ]);
    const out = new CompendiumEditorSuggest({} as never, reg, () => new Set()).getSuggestions(
      ctxFor("fireball"),
    );
    expect(out.map((e) => e.slug)).toEqual(["z_spell_fireball", "a_spell_fireball"]);
  });

  it("untyped results still match what the search-based path produced", () => {
    const reg = buildMockRegistry(entries);
    const hidden = new Set(["Hidden HB"]);
    const swept: RegisteredEntity[] = reg.search("fire", undefined, Number.POSITIVE_INFINITY);
    const oracle = swept.filter((e) => !hidden.has(e.compendium)).slice(0, 20);
    const out = new CompendiumEditorSuggest({} as never, reg, () => hidden).getSuggestions(ctxFor("fire"));
    expect(out.map((e) => e.slug)).toEqual(oracle.map((e) => e.slug));
  });
});
