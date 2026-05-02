// Regression: bundle ships exactly one Defender Longsword per edition (PC-7 LI-3)
//
// PC-1's audit surfaced a runtime registry duplicate: vaults pre-dating the
// canonical pipeline could carry a stale `Defender Longsword.md` (slug
// `defender-longsword`) alongside the pipeline-emitted
// `Defender (Longsword).md` (slug `srd-5e_defender-longsword` /
// `srd-2024_defender-longsword`). The bundle itself is clean — this test
// pins that invariant so a future merger or expand-variants regression that
// re-introduces an unprefixed sibling fails loudly.
//
// Note: vaults predating the canonical pipeline may still carry the legacy
// unprefixed file. A future pass on the plugin's bootstrap could clean such
// leftovers up; that's out of scope for PC-7.

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const BUNDLE_ROOT = path.resolve(__dirname, "../../.compendium-bundle");

interface DefenderEntry {
  filePath: string;
  slug: string | null;
  name: string | null;
}

function listDefenderEntries(magicItemsDir: string): DefenderEntry[] {
  if (!fs.existsSync(magicItemsDir)) return [];
  const out: DefenderEntry[] = [];
  for (const entry of fs.readdirSync(magicItemsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (!/defender/i.test(entry.name)) continue;
    const full = path.join(magicItemsDir, entry.name);
    const content = fs.readFileSync(full, "utf-8");
    const slugMatch = content.match(/^slug:\s*(\S+)\s*$/m);
    const nameMatch = content.match(/^name:\s*(.+?)\s*$/m);
    out.push({
      filePath: full,
      slug: slugMatch ? slugMatch[1] : null,
      name: nameMatch ? nameMatch[1] : null,
    });
  }
  return out;
}

describe("SRD bundle: Defender (Longsword) uniqueness (PC-7 LI-3)", () => {
  const bundleExists = fs.existsSync(BUNDLE_ROOT);
  if (!bundleExists) {
    it.skip("bundle not built; run `npm run build:srd-canonical` first", () => {});
    return;
  }

  it("SRD 5e ships exactly one Defender Longsword and it carries the prefixed slug", () => {
    const entries = listDefenderEntries(path.join(BUNDLE_ROOT, "SRD 5e", "Magic Items"));
    const longswords = entries.filter((e) => e.slug === "srd-5e_defender-longsword");
    expect(longswords).toHaveLength(1);

    // No bare/unprefixed `defender-longsword` slug should ever ship from the
    // pipeline — that's the legacy-vault collision shape.
    const bareLongswords = entries.filter((e) => e.slug === "defender-longsword");
    expect(bareLongswords).toHaveLength(0);
  });

  it("SRD 2024 ships exactly one Defender Longsword and it carries the prefixed slug", () => {
    const entries = listDefenderEntries(path.join(BUNDLE_ROOT, "SRD 2024", "Magic Items"));
    const longswords = entries.filter((e) => e.slug === "srd-2024_defender-longsword");
    expect(longswords).toHaveLength(1);

    const bareLongswords = entries.filter((e) => e.slug === "defender-longsword");
    expect(bareLongswords).toHaveLength(0);
  });
});
