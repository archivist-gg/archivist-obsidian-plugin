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

const BUNDLE_INDEX = path.resolve(__dirname, "../../.compendium-bundle/index.json");

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
