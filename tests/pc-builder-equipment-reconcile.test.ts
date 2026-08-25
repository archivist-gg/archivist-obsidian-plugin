import { describe, it, expect } from "vitest";
import { goldStep, alreadySeeded } from "../packages/obsidian/src/modules/pc/builder/equipment-reconcile";
import type { GrantedEntry } from "../packages/obsidian/src/modules/pc/builder/equipment-seed";
import type { EquipmentEntry } from "@archivist-gg/dnd5e/pc/pc.types";

const g = (slug: string, qty = 1): GrantedEntry => ({ slug, qty, equipped: false, slot: null });

describe("goldStep — rule 1, adopt", () => {
  it("with no baseline it seeds the pair and lands nothing", () => {
    expect(goldStep({ G: 155, baseline: null, currentGp: 7 }))
      .toEqual({ landed: 0, applied: 155, lastG: 155 });
  });
});

describe("goldStep — rule 2, unchanged contribution", () => {
  it("returns null (no call at all) when G equals lastG, even if applied differs", () => {
    // applied !== lastG is the post-clamp state; rule 2 must still suppress the call.
    expect(goldStep({ G: 0, baseline: { applied: 153, lastG: 0 }, currentGp: 500 })).toBeNull();
  });
});

describe("goldStep — rule 3, clamped delta", () => {
  it("applies the difference against `applied`, not against `lastG`", () => {
    // The §9.1 prescribed fixture: 7 / 100 / 155 / +55 / 62. No two values coincide.
    expect(goldStep({ G: 155, baseline: { applied: 100, lastG: 100 }, currentGp: 7 }))
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
  });
});

describe("goldStep — the G18 sequence: a clamped reclaim must not create gold", () => {
  it("wallet 7 -> +155 -> spend 160 -> reclaim -> re-grant lands +2, not +155", () => {
    let bag = goldStep({ G: 0, baseline: null, currentGp: 7 })!;            // adopt
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

describe("alreadySeeded — the world-relative gear gate", () => {
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

  it("false on a QTY SHORTFALL — a hand-added single javelin must not suppress javelin x4", () => {
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
  });

  it("compares FULL edition slugs on both sides, with no bare-izing", () => {
    expect(alreadySeeded([g("srd-5e_weapon_dagger")], [untagged("[[dagger]]")])).toBe(false);
    expect(alreadySeeded([g("srd-5e_weapon_dagger")], [untagged("[[srd-5e_weapon_dagger]]")])).toBe(true);
  });

  it("an empty resolved set is vacuously satisfied (the call would be a no-op anyway)", () => {
    expect(alreadySeeded([], [untagged("[[anything]]")])).toBe(true);
  });
});
