// MD-through-parser harness: validates that every MD emitted by the canonical
// pipeline parses with its corresponding runtime parser.
//
// This is "the test that would have caught the original deploy break" — a
// generic harness keyed on codeblock language that exercises all per-kind
// parsers against the actual bundle output.
//
// This harness will fail RED until per-kind merger fixes (Phases 2-6) land.
// Each per-kind phase greens up its slice. See plan
// docs/superpowers/specs/2026-05-01-srd-canonical-pipeline-completion.md.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { parseArmor } from "../../src/modules/armor/armor.parser";
import { parseBackground } from "../../src/modules/background/background.parser";
import { parseClass } from "../../src/modules/class/class.parser";
import { parseFeat } from "../../src/modules/feat/feat.parser";
import { parseItem } from "../../src/modules/item/item.parser";
import { parseMonster } from "../../src/modules/monster/monster.parser";
import { parseOptionalFeature } from "../../src/modules/optional-feature/optional-feature.parser";
import { parseRace } from "../../src/modules/race/race.parser";
import { parseSpell } from "../../src/modules/spell/spell.parser";
import { parseWeapon } from "../../src/modules/weapon/weapon.parser";

const BUNDLE_ROOT = path.resolve(__dirname, "../../.compendium-bundle");

type ParseFn = (
  source: string,
) => { success: true; data: unknown } | { success: false; error: unknown };

// Codeblock languages encountered in the bundle. Subclass MDs (e.g. Life
// Domain, Champion) emit a `class` codeblock — there is no `subclass` lang —
// so parseClass covers them.
const PARSER_MAP: Record<string, ParseFn> = {
  armor: parseArmor,
  background: parseBackground,
  class: parseClass,
  feat: parseFeat,
  item: parseItem,
  monster: parseMonster,
  "optional-feature": parseOptionalFeature,
  race: parseRace,
  spell: parseSpell,
  weapon: parseWeapon,
  // condition: no runtime parser exists yet — skipped via SKIPPED_LANGS.
};

const SKIPPED_LANGS = new Set<string>(["condition"]);

// Sanity: PARSER_MAP and SKIPPED_LANGS must not overlap.
for (const lang of SKIPPED_LANGS) {
  if (PARSER_MAP[lang]) {
    throw new Error(
      `Lang "${lang}" is in both PARSER_MAP and SKIPPED_LANGS — remove from SKIPPED_LANGS once a parser exists.`,
    );
  }
}

interface BundleMd {
  filePath: string;
  codeblockLang: string;
  yamlBody: string;
}

function walkBundle(): BundleMd[] {
  const out: BundleMd[] = [];
  if (!fs.existsSync(BUNDLE_ROOT)) return out;

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
        const content = fs.readFileSync(full, "utf-8");
        // Match the first fenced codeblock with a language tag. Each canonical
        // MD has exactly one such block holding the entity body as YAML.
        const m = content.match(/```([A-Za-z][\w-]*)\r?\n([\s\S]*?)\r?\n```/);
        if (!m) continue;
        out.push({ filePath: full, codeblockLang: m[1], yamlBody: m[2] });
      }
    }
  }
  walk(BUNDLE_ROOT);
  return out;
}

describe("MD-through-parser: every emitted bundle MD parses with its runtime parser", () => {
  const bundleExists = fs.existsSync(BUNDLE_ROOT);

  if (!bundleExists) {
    it.skip("bundle not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  const entries = walkBundle();

  it("bundle has at least 2500 MD files (sanity check)", () => {
    expect(entries.length).toBeGreaterThan(2500);
  });

  for (const entry of entries) {
    const rel = path.relative(BUNDLE_ROOT, entry.filePath);

    if (SKIPPED_LANGS.has(entry.codeblockLang)) {
      it.skip(`(skipped lang=${entry.codeblockLang}) ${rel}`, () => {});
      continue;
    }

    const parser = PARSER_MAP[entry.codeblockLang];
    if (!parser) {
      it(`unregistered codeblock lang in ${rel}: "${entry.codeblockLang}"`, () => {
        // Unknown lang — fail loudly so it gets added to PARSER_MAP or
        // SKIPPED_LANGS, or so the merger gets fixed if the lang is a typo.
        throw new Error(`No parser registered for codeblock lang: ${entry.codeblockLang}`);
      });
      continue;
    }

    it(`parses ${rel}`, () => {
      const result = parser(entry.yamlBody);
      if (!result.success) {
        const errSummary =
          typeof result.error === "string"
            ? result.error
            : JSON.stringify(result.error, null, 2);
        throw new Error(
          `Parser rejected ${rel}\n` +
            `Error: ${errSummary.slice(0, 1000)}\n` +
            `Body (first 500):\n${entry.yamlBody.slice(0, 500)}`,
        );
      }
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  }
});
