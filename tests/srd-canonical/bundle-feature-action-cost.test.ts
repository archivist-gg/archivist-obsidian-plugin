// Regression: SRD-2024 class features carry their authored action economy in
// the embedded bundle (Task E · Second Wind economy fix).
//
// Root cause was upstream in the dnd5e SRD generator: the class/subclass merger
// read the WRONG overlay field (`overlaid.action` instead of `overlaid.action_cost`),
// so the authored action cost was silently dropped. Features like Second Wind
// then rendered under Passive on the PC sheet (buildActionModel derives economy
// from `feature.action`). The merger fix + offline injection restore the field.
//
// This pins the corrected slice on the TRACKED, embedded `index.json` (the exact
// bytes esbuild inlines into main.js), asserting via parseClass that the runtime
// feature carries `action`. Ground truth = the srd-2024.yaml overlay action_cost.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseClass } from "@archivist-gg/dnd5e/class/class.parser";
import { parseRace } from "@archivist-gg/dnd5e/race/race.parser";

const BUNDLE_INDEX = path.resolve(__dirname, "../../.compendium-bundle/index.json");

interface RaceLike {
  traits: Array<{ name: string; action?: string; action_cost?: string }>;
}

interface ClassLike {
  features_by_level: Record<string, Array<{ id?: string; name: string; action?: string }>>;
}

function loadClassBundleEntry(bundleKey: string): ClassLike {
  const raw = fs.readFileSync(BUNDLE_INDEX, "utf-8");
  const bundle = JSON.parse(raw) as Record<string, string>;
  const md = bundle[bundleKey];
  if (!md) throw new Error(`Bundle entry not found: ${bundleKey}`);
  const m = md.match(/```class\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw new Error(`No class codeblock in ${bundleKey}`);
  const result = parseClass(m[1]);
  if (!result.success) throw new Error(`parseClass failed for ${bundleKey}: ${JSON.stringify(result.error)}`);
  return result.data as ClassLike;
}

function loadRaceBundleEntry(bundleKey: string): RaceLike {
  const raw = fs.readFileSync(BUNDLE_INDEX, "utf-8");
  const bundle = JSON.parse(raw) as Record<string, string>;
  const md = bundle[bundleKey];
  if (!md) throw new Error(`Bundle entry not found: ${bundleKey}`);
  const m = md.match(/```race\r?\n([\s\S]*?)\r?\n```/);
  if (!m) throw new Error(`No race codeblock in ${bundleKey}`);
  const result = parseRace(m[1]);
  if (!result.success) throw new Error(`parseRace failed for ${bundleKey}: ${JSON.stringify(result.error)}`);
  return result.data as unknown as RaceLike;
}

function findFeature(cls: ClassLike, id: string): { id?: string; name: string; action?: string } | undefined {
  return Object.values(cls.features_by_level).flat().find((f) => f.id === id);
}

describe("SRD 2024 bundle: authored feature action economy (Task E)", () => {
  const bundleExists = fs.existsSync(BUNDLE_INDEX);
  if (!bundleExists) {
    it.skip("bundle index not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  it("Fighter's Second Wind carries action: bonus-action (not Passive)", () => {
    const fighter = loadClassBundleEntry("SRD 2024/Classes/Fighter.md");
    const secondWind = findFeature(fighter, "second-wind");
    expect(secondWind, "Second Wind must exist in Fighter.md").toBeDefined();
    expect(secondWind?.action).toBe("bonus-action");
  });

  it("Fighter's Action Surge carries action: special", () => {
    const fighter = loadClassBundleEntry("SRD 2024/Classes/Fighter.md");
    const actionSurge = findFeature(fighter, "action-surge");
    expect(actionSurge, "Action Surge must exist in Fighter.md").toBeDefined();
    expect(actionSurge?.action).toBe("special");
  });

  it("Barbarian's Rage carries action: bonus-action", () => {
    const barbarian = loadClassBundleEntry("SRD 2024/Classes/Barbarian.md");
    const rage = findFeature(barbarian, "rage");
    expect(rage, "Rage must exist in Barbarian.md").toBeDefined();
    expect(rage?.action).toBe("bonus-action");
  });
});

/**
 * R4-G3a §10.2.1/§10.3 · the RACE half of the same guarantee, on the REAL bundle bytes.
 *
 * `action_cost` at feature level exists only here, on race traits, and the parser aliases it onto
 * the canonical `action` the badge router reads. These are all five carriers spec §10.1 enumerates.
 * The dnd5e package cannot make this assertion against the real files (it ships to npm and holds no
 * bundle), so its own suite pins byte-verbatim COPIES in `tests/feature-alias-action-cost.test.ts`;
 * this is the pin that reads the shipped bytes and would catch those copies drifting.
 */
const RACE_ACTION_COST_CARRIERS: ReadonlyArray<readonly [string, string, string]> = [
  ["SRD 5e/Races/Half-Orc.md", "Relentless Endurance", "special"],
  ["SRD 5e/Races/Dragonborn.md", "Breath Weapon", "action"],
  ["SRD 2024/Races/Dwarf.md", "Stonecunning", "bonus-action"],
  ["SRD 2024/Races/Orc.md", "Adrenaline Rush", "bonus-action"],
  ["SRD 2024/Races/Dragonborn.md", "Breath Weapon", "action"],
];

describe("bundle race traits: action_cost aliases onto action (R4-G3a §10.2.1)", () => {
  const bundleExists = fs.existsSync(BUNDLE_INDEX);
  if (!bundleExists) {
    it.skip("bundle index not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  it.each(RACE_ACTION_COST_CARRIERS)("%s · %s carries action: %s", (file, traitName, expected) => {
    const race = loadRaceBundleEntry(file);
    const trait = race.traits.find((t) => t.name === traitName);
    expect(trait, `${traitName} must exist in ${file}`).toBeDefined();
    expect(trait?.action).toBe(expected);        // the alias wrote the canonical key
    expect(trait?.action_cost).toBe(expected);   // the declared one is retained, never deleted
  });

  it("those five are the WHOLE population, so a new carrier cannot appear unpinned", () => {
    const bundle = JSON.parse(fs.readFileSync(BUNDLE_INDEX, "utf-8")) as Record<string, string>;
    const found: string[] = [];
    for (const [key, md] of Object.entries(bundle)) {
      if (!/```race\r?\n/.test(md)) continue;
      const race = loadRaceBundleEntry(key);
      for (const t of race.traits ?? []) if (t.action_cost) found.push(`${key}::${t.name}`);
    }
    expect(found.sort()).toEqual(
      RACE_ACTION_COST_CARRIERS.map(([f, t]) => `${f}::${t}`).sort(),
    );
  });
});
