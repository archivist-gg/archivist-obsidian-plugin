// PC numerical regression — Grendal × canonical bundle.
//
// Loads Grendal's redacted PC fixture, populates an EntityRegistry from the
// emitted canonical bundle (.compendium-bundle/SRD 5e), runs the production
// PC parser → resolver → recalc pipeline, and asserts the derived stats are
// in a sensible range. Locks in that the canonical pipeline produces data
// rich enough for a real PC's mechanics to resolve end-to-end.
//
// Task 9.2 of the SRD Canonical Pipeline Completion plan. The bundle must be
// built first (`npm run build:srd-canonical`); if missing the suite skips.
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { extractPCCodeBlock, parsePC } from "../src/modules/pc/pc.parser";
import { PCResolver } from "../src/modules/pc/pc.resolver";
import { recalc } from "../src/modules/pc/pc.recalc";
import { parseEntityFile } from "../src/shared/entities/entity-vault-store";
import {
  EntityRegistry,
  type RegisteredEntity,
} from "../src/shared/entities/entity-registry";

const BUNDLE_ROOT = path.resolve(__dirname, "../.compendium-bundle");
const SRD_5E_ROOT = path.join(BUNDLE_ROOT, "SRD 5e");
const FIXTURE_PATH = path.join(__dirname, "fixtures/grendal-test-pc.md");

/**
 * Walk every `.md` file under `SRD 5e` and register an entity per file using
 * the same `parseEntityFile` helper that compendium-manager uses in production.
 * This is intentionally close to runtime: the only difference is that we read
 * directly off the filesystem instead of through a Vault adapter.
 */
function loadCanonicalBundleRegistry(): EntityRegistry {
  const registry = new EntityRegistry();
  if (!fs.existsSync(SRD_5E_ROOT)) return registry;

  const stack: string[] = [SRD_5E_ROOT];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name.startsWith("_")) continue; // _compendium.md and friends

      const content = fs.readFileSync(full, "utf-8");
      const note = parseEntityFile(content);
      if (!note) continue;

      const registered: RegisteredEntity = {
        slug: note.slug,
        name: note.name,
        entityType: note.entityType,
        filePath: path.relative(BUNDLE_ROOT, full),
        data: note.data,
        compendium: note.compendium,
        readonly: true,
        homebrew: false,
      };
      registry.register(registered);
    }
  }
  return registry;
}

describe("PC numerical regression — Grendal", () => {
  const bundleExists = fs.existsSync(SRD_5E_ROOT);

  if (!bundleExists) {
    it.skip("bundle not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  it("parses Grendal's PC fixture without errors", () => {
    const md = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const block = extractPCCodeBlock(md);
    expect(block).not.toBeNull();
    const parsed = parsePC(block!.yaml);
    expect(parsed.success).toBe(true);
  });

  it("registers a non-trivial number of entities from the canonical bundle", () => {
    const registry = loadCanonicalBundleRegistry();
    // Sanity floor — the bundle ships thousands of entries; if this drops to
    // a handful something is wrong with the bundle build or the loader.
    expect(registry.count()).toBeGreaterThan(500);
    // The slugs Grendal references must each resolve to a registered entity.
    expect(registry.getByTypeAndSlug("race", "srd-5e_dwarf")).toBeDefined();
    expect(registry.getByTypeAndSlug("class", "srd-5e_fighter")).toBeDefined();
    expect(registry.getByTypeAndSlug("background", "srd-5e_acolyte")).toBeDefined();
    expect(registry.getByTypeAndSlug("weapon", "srd-5e_longsword")).toBeDefined();
    expect(registry.getByTypeAndSlug("item", "srd-5e_arrow-catching-shield")).toBeDefined();
  });

  it("recalcs Grendal to sensible derived stats after canonical bundle is loaded", () => {
    const md = fs.readFileSync(FIXTURE_PATH, "utf-8");
    const block = extractPCCodeBlock(md);
    if (!block) throw new Error("expected a `pc` codeblock in fixture");
    const parsed = parsePC(block.yaml);
    if (!parsed.success) throw new Error(`parsePC failed: ${parsed.error}`);

    const registry = loadCanonicalBundleRegistry();
    const resolved = new PCResolver(registry).resolve(parsed.data);

    // The resolver pushes a warning for any unresolved slug; surfacing them
    // here makes failures debuggable. Anything left in `warnings` here is an
    // honest gap in the canonical bundle for this PC's references.
    const expectedResolved = [
      "race=srd-5e_dwarf",
      "class[0]=srd-5e_fighter",
      "background=srd-5e_acolyte",
    ];
    const failedExpected = expectedResolved.filter((id) =>
      resolved.warnings.some((w) => w.includes(id.split("=")[1]!)),
    );
    expect(failedExpected).toEqual([]);

    const derived = recalc(resolved.character, registry);

    // Sensible-stats assertions — deliberately loose so this test stays a
    // canary for "the canonical bundle still produces resolvable PC data"
    // rather than a brittle expected-value snapshot.
    expect(derived.totalLevel).toBe(5);
    expect(derived.proficiencyBonus).toBe(3);
    expect(derived.hp.max).toBeGreaterThan(0);
    expect(derived.hp.max).toBeLessThan(200);
    expect(derived.ac).toBeGreaterThan(10);
    expect(derived.ac).toBeLessThan(30);
    expect(derived.speed).toBeGreaterThan(0);
    expect(derived.attacks.length).toBeGreaterThan(0);

    // The longsword Grendal wields must produce an attack row with a
    // non-zero to-hit (STR proficient + martial prof + PB).
    const longsword = derived.attacks.find((a) => /longsword/i.test(a.name));
    expect(longsword).toBeDefined();
    expect(longsword!.toHit).not.toBe(0);

    // Saves: derived.saves[ab].bonus must always be a finite number.
    for (const ab of ["str", "dex", "con", "int", "wis", "cha"] as const) {
      expect(Number.isFinite(derived.saves[ab].bonus)).toBe(true);
    }
  });
});
