/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import type { RegisteredEntity } from "@archivist-gg/core";
import { compendiumEntityCounts } from "../packages/obsidian/src/core/settings-tab";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

const ent = (slug: string, name: string, compendium: string, entityType = "spell") => ({
  slug,
  name,
  entityType,
  data: {},
  compendium,
});

/** PARITY ORACLE ONLY. The helper's own pool is `getAllSlugs()`/`getBySlug()`
 *  (spec §8 item 2) — never a second `search` sweep. This reproduces what the
 *  retired `registry.search("", undefined, 99999)` loop body computed, so the
 *  one-pass rewrite is pinned against the behaviour it replaced. */
function sweepOracle(reg: ReturnType<typeof buildMockRegistry>): Map<string, number> {
  const out = new Map<string, number>();
  const all: RegisteredEntity[] = reg.search("", undefined, 99999);
  for (const e of all) out.set(e.compendium, (out.get(e.compendium) ?? 0) + 1);
  return out;
}

describe("compendiumEntityCounts", () => {
  const reg = buildMockRegistry([
    ent("srd_spell_fireball", "Fireball", "SRD 5e"),
    ent("srd_spell_light", "Light", "SRD 5e"),
    ent("srd_item_rope", "Rope", "SRD 5e", "item"),
    ent("me_spell_zap", "Zap", "Me"),
    ent("me_item_pole", "Pole", "Me", "item"),
    ent("hb_monster_gribble", "Gribble", "Third Party", "monster"),
  ]);

  it("equals the per-compendium counts a full search sweep would produce", () => {
    const counts = compendiumEntityCounts(reg);
    expect(counts).toEqual(sweepOracle(reg));
    // Pinned literals as well: an oracle that itself broke would otherwise
    // agree with a broken helper.
    expect(counts.get("SRD 5e")).toBe(3);
    expect(counts.get("Me")).toBe(2);
    expect(counts.get("Third Party")).toBe(1);
    expect([...counts.keys()].sort()).toEqual(["Me", "SRD 5e", "Third Party"]);
  });

  it("counts across entity types, not per type", () => {
    // "SRD 5e" holds 2 spells + 1 item: a per-type pass would report 2 or 1.
    expect(compendiumEntityCounts(reg).get("SRD 5e")).toBe(3);
  });

  /** THE OMISSION (F-4). A registry cannot contain a zero-entity compendium —
   *  it only knows entities — so the helper CANNOT key "Empty HB". That absence
   *  is exactly why `display()` reads `counts.get(comp.name) ?? 0`; the row-level
   *  witness that a zero-entity compendium still renders "0 entities" lives in
   *  tests/settings-tab.test.ts, which renders rows from the compendium manager. */
  it("OMITS a compendium with no entities (the ?? 0 at the call site is why)", () => {
    const counts = compendiumEntityCounts(reg);
    expect(counts.has("Empty HB")).toBe(false);
    expect(counts.get("Empty HB")).toBeUndefined();
  });

  it("returns an empty map for undefined", () => {
    const counts = compendiumEntityCounts(undefined);
    expect(counts).toBeInstanceOf(Map);
    expect(counts.size).toBe(0);
  });

  /** `main.ts` declares `entityRegistry: EntityRegistry | null`, so `null` is
   *  the shape the call site actually passes before the vault has loaded. */
  it("returns an empty map for null", () => {
    const counts = compendiumEntityCounts(null);
    expect(counts).toBeInstanceOf(Map);
    expect(counts.size).toBe(0);
  });

  it("returns an empty map for an empty registry", () => {
    expect(compendiumEntityCounts(buildMockRegistry([])).size).toBe(0);
  });
});
