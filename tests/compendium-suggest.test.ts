import { describe, it, expect } from "vitest";
import { detectCompendiumTrigger, adjustEndForBracketMatch } from "../packages/obsidian/src/shared/extensions/compendium-suggest";
import { CompendiumEditorSuggest } from "../packages/obsidian/src/shared/extensions/compendium-suggest";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { EditorSuggestContext } from "obsidian";

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
