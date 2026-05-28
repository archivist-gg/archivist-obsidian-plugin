// tests/srd-canonical/data/item-conditions.test.ts
import { describe, it, expect } from "vitest";
import {
  CURATED_ITEM_CONDITIONS,
  type ConditionPerField,
} from "../../../tools/srd-canonical/data/item-conditions";

const VALID_EDITIONS = ["srd-5e_", "srd-2024_"];
const VALID_FIELDS = new Set([
  "ac",
  "saving_throws",
  "spell_attack",
  "spell_save_dc",
  "weapon_attack",
  "weapon_damage",
  "ability_scores.bonus.str",
  "ability_scores.bonus.dex",
  "ability_scores.bonus.con",
  "ability_scores.bonus.int",
  "ability_scores.bonus.wis",
  "ability_scores.bonus.cha",
  "speed.walk",
  "speed.fly",
  "speed.swim",
  "speed.climb",
]);

describe("CURATED_ITEM_CONDITIONS", () => {
  it("seeds at least 13 entries (recovered from c8c7436)", () => {
    expect(Object.keys(CURATED_ITEM_CONDITIONS).length).toBeGreaterThanOrEqual(13);
  });

  it("every key uses an edition prefix", () => {
    for (const slug of Object.keys(CURATED_ITEM_CONDITIONS)) {
      const ok = VALID_EDITIONS.some(p => slug.startsWith(p));
      expect(ok, `slug "${slug}" must start with srd-5e_ or srd-2024_`).toBe(true);
    }
  });

  it("every condition list targets a valid BonusFieldPath", () => {
    for (const [slug, perField] of Object.entries(CURATED_ITEM_CONDITIONS) as [string, ConditionPerField][]) {
      for (const field of Object.keys(perField)) {
        expect(VALID_FIELDS.has(field), `${slug}: invalid field ${field}`).toBe(true);
      }
    }
  });

  it("every Condition[] is non-empty", () => {
    for (const [slug, perField] of Object.entries(CURATED_ITEM_CONDITIONS) as [string, ConditionPerField][]) {
      for (const [field, conds] of Object.entries(perField)) {
        expect(Array.isArray(conds) && conds.length > 0, `${slug}.${field}: empty conditions`).toBe(true);
      }
    }
  });
});
