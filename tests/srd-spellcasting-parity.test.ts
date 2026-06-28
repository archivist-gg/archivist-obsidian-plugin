import { describe, it, expect } from "vitest";
import cls2014 from "../packages/dnd5e/src/srd/data/runtime/class.2014.json";
import cls2024 from "../packages/dnd5e/src/srd/data/runtime/class.2024.json";

type Sc = { caster_type: string; ability: string; preparation: string; spell_list: string } | null;
type Cls = { slug: string; name: string; spellcasting: Sc };

const arr = (d: unknown): Cls[] => (Array.isArray(d) ? d : Object.values(d as object)) as Cls[];
// Precise bare-slug match: "srd-5e_wizard" or "srd-2024_wizard" -> "wizard".
const find = (d: unknown, slug: string): Cls => {
  const hit = arr(d).find((c) => c.slug === slug || c.slug.endsWith(`_${slug}`));
  if (!hit) throw new Error(`class not found: ${slug}`);
  return hit;
};

// Expected spellcasting per caster — these mirror the deleted PROFILES exactly.
// [caster_type, ability, preparation]; spell_list is asserted to equal the bare slug.
const EXPECT_2014: Record<string, [string, string, string]> = {
  bard: ["full", "cha", "known"],
  cleric: ["full", "wis", "prepared"],
  druid: ["full", "wis", "prepared"],
  paladin: ["half", "cha", "prepared"],
  ranger: ["half", "wis", "known"],
  sorcerer: ["full", "cha", "known"],
  warlock: ["pact", "cha", "known"],
  wizard: ["full", "int", "prepared"],
};
// 2024: identical EXCEPT bard & ranger become "prepared".
const EXPECT_2024: Record<string, [string, string, string]> = {
  ...EXPECT_2014,
  bard: ["full", "cha", "prepared"],
  ranger: ["half", "wis", "prepared"],
};

const NON_CASTERS = ["barbarian", "fighter", "monk", "rogue"];

describe("SRD spellcasting parity — 2014 (mirrors deleted PROFILES)", () => {
  for (const [slug, [ct, ab, prep]] of Object.entries(EXPECT_2014)) {
    it(`${slug}: ${ct}/${ab}/${prep}, spell_list=${slug}`, () => {
      const sc = find(cls2014, slug).spellcasting;
      expect(sc).not.toBeNull();
      expect([sc!.caster_type, sc!.ability, sc!.preparation]).toEqual([ct, ab, prep]);
      expect(sc!.spell_list).toBe(slug);
    });
  }
});

describe("SRD spellcasting parity — 2024 (bard & ranger become prepared)", () => {
  for (const [slug, [ct, ab, prep]] of Object.entries(EXPECT_2024)) {
    it(`${slug}: ${ct}/${ab}/${prep}, spell_list=${slug}`, () => {
      const sc = find(cls2024, slug).spellcasting;
      expect(sc).not.toBeNull();
      expect([sc!.caster_type, sc!.ability, sc!.preparation]).toEqual([ct, ab, prep]);
      expect(sc!.spell_list).toBe(slug);
    });
  }
});

describe("SRD non-casters have null spellcasting (both editions)", () => {
  for (const slug of NON_CASTERS) {
    it(`${slug} 2014 + 2024 → null`, () => {
      expect(find(cls2014, slug).spellcasting).toBeNull();
      expect(find(cls2024, slug).spellcasting).toBeNull();
    });
  }
});
