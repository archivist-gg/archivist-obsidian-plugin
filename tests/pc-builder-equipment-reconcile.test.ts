import { describe, it, expect } from "vitest";
import { goldStep, alreadySeeded, uncoveredByUntagged, type GoldBaseline } from "../packages/obsidian/src/modules/pc/builder/equipment-reconcile";
import type { GrantedEntry } from "../packages/obsidian/src/modules/pc/builder/equipment-seed";
import type { EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";

const g = (slug: string, qty = 1): GrantedEntry => ({ slug, qty, equipped: false, slot: null });

describe("goldStep · rule 1, adopt", () => {
  it("with no baseline it seeds the pair and lands nothing", () => {
    expect(goldStep({ G: 155, baseline: null, currentGp: 7 }))
      .toEqual({ landed: 0, applied: 155, lastG: 155 });
  });
});

describe("goldStep · rule 2, unchanged contribution", () => {
  it("returns null (no call at all) when G equals lastG, even if applied differs", () => {
    // applied !== lastG is the post-clamp state; rule 2 must still suppress the call.
    expect(goldStep({ G: 0, baseline: { applied: 153, lastG: 0 }, currentGp: 500 })).toBeNull();
  });
});

describe("goldStep · a non-finite contribution owes nothing and never reaches the pair", () => {
  it("returns null with no baseline (never adopts NaN into the pair)", () => {
    expect(goldStep({ G: Number.NaN, baseline: null, currentGp: 7 })).toBeNull();
  });

  it("returns null with a baseline, even when G differs from lastG", () => {
    expect(goldStep({ G: Number.POSITIVE_INFINITY, baseline: { applied: 100, lastG: 90 }, currentGp: 7 }))
      .toBeNull();
  });
});

describe("goldStep · rule 3, clamped delta", () => {
  it("applies the difference against `applied`, not against `lastG`", () => {
    // The §9.1 prescribed fixture: 7 / 90 / 100 / 155 / +55 / 62. No two values coincide,
    // and `applied` (100) differs from `lastG` (90) so a read of the wrong field lands 65, not 55.
    expect(goldStep({ G: 155, baseline: { applied: 100, lastG: 90 }, currentGp: 7 }))
      .toEqual({ landed: 55, applied: 155, lastG: 155 });
  });

  it("floors a reclaim at the wallet and records only what landed", () => {
    expect(goldStep({ G: 0, baseline: { applied: 155, lastG: 155 }, currentGp: 2 }))
      .toEqual({ landed: -2, applied: 153, lastG: 0 });
  });

  it("ceilings a grant at MAX_COIN and records only what landed", () => {
    expect(goldStep({ G: 100, baseline: { applied: 0, lastG: 0 }, currentGp: 999_999 }))
      .toEqual({ landed: 0, applied: 0, lastG: 100 });
  });

  it("truncates a fractional difference toward zero, matching adjustCurrency", () => {
    expect(goldStep({ G: 50.75, baseline: { applied: 0, lastG: 0 }, currentGp: 0 }))
      .toEqual({ landed: 50, applied: 50, lastG: 50.75 });
    // The NEGATIVE arm is the one that discriminates trunc from floor: the
    // positive fixture above agrees under both. intended = trunc(0 - 50.75) = -50
    // (floor would give -51), the clamp window [-100, 999_899] does not bite, and
    // 50.75 - 50 = 0.75 is exact in binary (floor would leave -0.25).
    expect(goldStep({ G: 0, baseline: { applied: 50.75, lastG: 1 }, currentGp: 100 }))
      .toEqual({ landed: -50, applied: 0.75, lastG: 0 });
  });
});

describe("goldStep · the G18 sequence: a clamped reclaim must not create gold", () => {
  it("wallet 7 -> +155 -> spend 160 -> reclaim -> re-grant lands +2, not +155", () => {
    let bag: GoldBaseline = goldStep({ G: 0, baseline: null, currentGp: 7 })!;  // adopt
    expect(bag).toEqual({ landed: 0, applied: 0, lastG: 0 });

    const grant = goldStep({ G: 155, baseline: bag, currentGp: 7 })!;       // pick "155 GP"
    expect(grant.landed).toBe(155);
    bag = { applied: grant.applied, lastG: grant.lastG };                   // wallet now 162

    // user spends 160 outside the builder -> wallet 2, no reconcile (G unchanged)
    expect(goldStep({ G: 155, baseline: bag, currentGp: 2 })).toBeNull();

    const reclaim = goldStep({ G: 0, baseline: bag, currentGp: 2 })!;       // Start Empty
    expect(reclaim.landed).toBe(-2);                                        // wallet 0
    bag = { applied: reclaim.applied, lastG: reclaim.lastG };
    expect(bag).toEqual({ applied: 153, lastG: 0 });

    const regrant = goldStep({ G: 155, baseline: bag, currentGp: 0 })!;     // Starting Equipment
    expect(regrant.landed).toBe(2);                                         // NOT 155
  });
});

describe("alreadySeeded · the world-relative gear gate", () => {
  const untagged = (item: string, qty?: number): EquipmentEntry =>
    (qty === undefined ? { item } : { item, qty }) as EquipmentEntry;

  it("false when the builder still owns tagged entries (conjunct 1)", () => {
    const eq = [
      { item: "[[srd-5e_armor_leather]]", granted_by: "builder:starting" },
      untagged("[[srd-5e_armor_leather]]"),
    ] as EquipmentEntry[];
    expect(alreadySeeded([g("srd-5e_armor_leather")], eq)).toBe(false);
  });

  it("true for the finishBuild shape: every resolved entry present untagged", () => {
    const eq = [untagged("[[srd-5e_armor_leather]]"), untagged("[[srd-5e_weapon_dagger]]", 2)];
    expect(alreadySeeded([g("srd-5e_armor_leather"), g("srd-5e_weapon_dagger", 2)], eq)).toBe(true);
  });

  it("false on a QTY SHORTFALL · a hand-added single javelin must not suppress javelin x4", () => {
    expect(alreadySeeded([g("srd-5e_weapon_javelin", 4)], [untagged("[[srd-5e_weapon_javelin]]")]))
      .toBe(false);
  });

  it("counts multiplicity across separate entries, not just presence", () => {
    const eq = [untagged("[[srd-5e_weapon_dagger]]"), untagged("[[srd-5e_weapon_dagger]]")];
    expect(alreadySeeded([g("srd-5e_weapon_dagger", 2)], eq)).toBe(true);
    expect(alreadySeeded([g("srd-5e_weapon_dagger", 3)], eq)).toBe(false);
  });

  it("free-text entries never match a resolved slug", () => {
    // Volker really carries `item: Traveler pack` with no wikilink.
    expect(alreadySeeded([g("srd-5e_item_traveler-pack")], [untagged("Traveler pack")])).toBe(false);
    // Same string as the slug but without the wikilink: still free text, still no match.
    expect(alreadySeeded([g("srd-5e_item_traveler-pack")], [untagged("srd-5e_item_traveler-pack")])).toBe(false);
  });

  it("compares FULL edition slugs on both sides, with no bare-izing", () => {
    expect(alreadySeeded([g("srd-5e_weapon_dagger")], [untagged("[[dagger]]")])).toBe(false);
    expect(alreadySeeded([g("srd-5e_weapon_dagger")], [untagged("[[srd-5e_weapon_dagger]]")])).toBe(true);
  });

  it("an empty resolved set is vacuously satisfied (the call would be a no-op anyway)", () => {
    expect(alreadySeeded([], [untagged("[[anything]]")])).toBe(true);
  });
});

describe("uncoveredByUntagged · the qty-aware subtraction the step seeds (R4-G3b final wave)", () => {
  const untagged = (item: string, qty?: number): EquipmentEntry =>
    (qty === undefined ? { item } : { item, qty }) as EquipmentEntry;

  it("FULL coverage returns nothing at all", () => {
    // RED FIRST before the final wave (e1ef541): the export did not exist, so
    // this call read `undefined` and threw `TypeError: uncoveredByUntagged is
    // not a function` before reaching the comparison. An ESM import of a missing
    // NAMED export does not fail the module, so the file LOADED and ran
    // `22 tests | 6 failed`: the 16 `goldStep` / `alreadySeeded` cases above
    // passed and only the six cases below threw, each at its own first call
    // (evidence/g3b-fw-a-red.txt). The values here are what the helper must
    // produce.
    expect(uncoveredByUntagged(
      [g("srd-5e_armor_leather"), g("srd-5e_weapon_dagger", 2)],
      [untagged("[[srd-5e_armor_leather]]"), untagged("[[srd-5e_weapon_dagger]]", 2)],
    )).toEqual([]);
  });

  it("PARTIAL qty coverage keeps the entry with only the REMAINING qty", () => {
    expect(uncoveredByUntagged(
      [g("srd-5e_weapon_javelin", 4)],
      [untagged("[[srd-5e_weapon_javelin]]")],
    )).toEqual([{ slug: "srd-5e_weapon_javelin", qty: 3, equipped: false, slot: null }]);
  });

  it("NO coverage returns the input, entry for entry and in order", () => {
    const resolved = [g("srd-5e_armor_leather"), g("srd-5e_weapon_dagger", 2)];
    const out = uncoveredByUntagged(resolved, []);
    expect(out).toEqual(resolved);
    // The uncovered entries are the resolved objects themselves, so a fresh
    // draft is seeded byte-for-byte what `resolveGrants` produced.
    expect(out[0]).toBe(resolved[0]);
    expect(out[1]).toBe(resolved[1]);
  });

  it("only UNTAGGED copies cover: the builder's own tagged block never does", () => {
    // Conjunct 1 of `alreadySeeded` has already failed here (a tagged entry
    // exists), so this is the path that decides what the replacement writes: the
    // builder's own copy must not cancel the grant that produced it.
    const eq = [
      { item: "[[srd-5e_armor_leather]]", granted_by: "builder:starting" },
      untagged("[[srd-5e_weapon_dagger]]"),
    ] as EquipmentEntry[];
    expect(uncoveredByUntagged([g("srd-5e_armor_leather"), g("srd-5e_weapon_dagger")], eq))
      .toEqual([{ slug: "srd-5e_armor_leather", qty: 1, equipped: false, slot: null }]);
  });

  it("counts multiplicity across separate untagged entries, and free text covers nothing", () => {
    expect(uncoveredByUntagged(
      [g("srd-5e_weapon_dagger", 3)],
      [untagged("[[srd-5e_weapon_dagger]]"), untagged("[[srd-5e_weapon_dagger]]")],
    )).toEqual([{ slug: "srd-5e_weapon_dagger", qty: 1, equipped: false, slot: null }]);
    expect(uncoveredByUntagged([g("srd-5e_item_traveler-pack")], [untagged("Traveler pack")]))
      .toEqual([g("srd-5e_item_traveler-pack")]);
  });

  it("two resolved entries on the same slug share the untagged pool, first come first served", () => {
    // `resolveGrants` can push the same slug twice (two `{item}` grants), so the
    // remaining count must carry across iterations rather than be re-read.
    expect(uncoveredByUntagged(
      [g("srd-5e_weapon_dagger"), g("srd-5e_weapon_dagger")],
      [untagged("[[srd-5e_weapon_dagger]]")],
    )).toEqual([{ slug: "srd-5e_weapon_dagger", qty: 1, equipped: false, slot: null }]);
  });
});
