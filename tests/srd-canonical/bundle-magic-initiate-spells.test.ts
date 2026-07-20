// Regression: the SRD-2024 Magic Initiate feat carries its nested spell choices
// in the embedded bundle (Task 3f · feats-grant-spells).
//
// Magic Initiate grants 2 cantrips + 1 level-1 spell from a chosen class list.
// Those picks nest under the chosen `spell-list` branch as `select-entity{spell}`
// choices (mi-cantrips level 0, mi-level1 level 1). Ground truth = the dnd5e
// srd-2024.yaml overlay; the SAME structure is offline-injected into the tracked,
// embedded `index.json` (the exact bytes esbuild inlines into main.js) so a
// re-seeded vault surfaces the picks without a full compendium regen. This pins
// that injected slice via parseFeat, asserting the runtime feat carries the
// nested choices under EACH class branch.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFeat } from "@archivist-gg/dnd5e/feat/feat.parser";

const BUNDLE_INDEX = path.resolve(__dirname, "../../.compendium-bundle/index.json");

interface InlineOption { value: string; label: string; choices?: SpellPick[] }
interface SpellPick { kind: string; id: string; count?: number; entity_type?: string; where?: { list?: string; level?: number; edition?: string } }
interface Inline { kind: string; id: string; options: InlineOption[] }

function loadMagicInitiateChoices(): unknown[] {
  const raw = fs.readFileSync(BUNDLE_INDEX, "utf-8");
  const bundle = JSON.parse(raw) as Record<string, string>;
  const md = bundle["SRD 2024/Feats/Magic Initiate.md"];
  if (!md) throw new Error("Bundle entry not found: SRD 2024/Feats/Magic Initiate.md");
  const m = md.match(/```feat\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw new Error("No feat codeblock in Magic Initiate.md");
  const result = parseFeat(m[1]);
  if (!result.success) throw new Error(`parseFeat failed: ${JSON.stringify(result.error)}`);
  return (result.data.choices ?? []) as unknown[];
}

describe("SRD 2024 bundle: Magic Initiate nested spell choices (Task 3f)", () => {
  const bundleExists = fs.existsSync(BUNDLE_INDEX);
  if (!bundleExists) {
    it.skip("bundle index not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  const choices = loadMagicInitiateChoices();
  const spellList = choices.find((c): c is Inline => (c as Inline).id === "spell-list")!;

  it("keeps the spell-list select-inline over cleric/druid/wizard", () => {
    expect(spellList).toBeDefined();
    expect(spellList.kind).toBe("select-inline");
    expect(spellList.options.map((o) => o.value).sort()).toEqual(["cleric", "druid", "wizard"]);
  });

  it("keeps the spellcasting-ability select-inline (int/wis/cha)", () => {
    const ability = choices.find((c): c is Inline => (c as Inline).id === "spellcasting-ability")!;
    expect(ability).toBeDefined();
    expect(ability.options.map((o) => o.value).sort()).toEqual(["cha", "int", "wis"]);
  });

  for (const list of ["cleric", "druid", "wizard"] as const) {
    it(`nests mi-cantrips (2, level 0) + mi-level1 (1, level 1) under the ${list} branch`, () => {
      const branch = spellList.options.find((o) => o.value === list)!;
      const nested = branch.choices ?? [];
      const cantrips = nested.find((c) => c.id === "mi-cantrips")!;
      const level1 = nested.find((c) => c.id === "mi-level1")!;

      expect(cantrips, `mi-cantrips missing under ${list}`).toBeDefined();
      expect(cantrips.entity_type).toBe("spell");
      expect(cantrips.count).toBe(2);
      expect(cantrips.where).toEqual({ list, level: 0, edition: "2024" });

      expect(level1, `mi-level1 missing under ${list}`).toBeDefined();
      expect(level1.entity_type).toBe("spell");
      expect(level1.count).toBe(1);
      expect(level1.where).toEqual({ list, level: 1, edition: "2024" });
    });
  }
});
