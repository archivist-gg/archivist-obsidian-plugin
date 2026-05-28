import { describe, it, expect } from "vitest";
import { readStructuredRules } from "../../../tools/srd-canonical/sources/structured-rules";
import { mergeKind, type MergeRule } from "../../../tools/srd-canonical/merger";
import * as path from "node:path";

const fixtureRoot = path.resolve(__dirname, "../fixtures/structured-rules");

// The user sets STRUCTURED_RULES_PATH on their machine; CI does not have
// access to the upstream data dump, so tests that depend on it skip cleanly
// when the env var is unset.
const SR_PATH = process.env.STRUCTURED_RULES_PATH;

describe("readStructuredRules slug matching", () => {
  it("matches against Open5e prefixed key shape (srd_<slug>) for 2014", async () => {
    const slugSet = new Set(["srd_alert"]);
    const result = await readStructuredRules({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet,
    });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Alert");
    expect(result[0].source).toBe("PHB");
  });

  it("matches against Open5e 2024 prefix shape (srd-2024_<slug>)", async () => {
    const slugSet = new Set(["srd-2024_alert"]);
    const result = await readStructuredRules({
      kind: "feats",
      edition: "2024",
      rootPath: fixtureRoot,
      slugSet,
    });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Alert");
    expect(result[0].source).toBe("XPHB");
  });

  it("returns empty when slug set has no matching prefixed keys", async () => {
    const result = await readStructuredRules({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(["alert"]), // bare slug without prefix should NOT match
    });
    expect(result).toEqual([]);
  });

  it("applies the edition prefix in readKindFromIndex (spells per-source dir)", async () => {
    const slugSet = new Set(["srd_fireball"]);
    const result = await readStructuredRules({
      kind: "spells",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet,
    });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Fireball");
    expect(result[0].source).toBe("PHB");
  });
});

describe.skipIf(!SR_PATH)("structured-rules join (real data)", () => {
  it("returns Wand of Magic Missiles with charges and attached spells when slugSet uses Open5e prefixed key", async () => {
    const slugSet = new Set(["srd_wand-of-magic-missiles"]);
    const out = await readStructuredRules({
      kind: "magicitems",
      edition: "2014",
      rootPath: SR_PATH!,
      slugSet,
    });
    const wand = out.find(e => e.name === "Wand of Magic Missiles");
    expect(wand).toBeDefined();
    expect(wand?.charges).toBe(7);
    expect(wand?.attachedSpells).toBeDefined();
  });

  it("mergeKind joins the structured entry to the Open5e base when base.key is the prefixed Open5e key", async () => {
    // Regression for I17: `mergeKind` previously indexed structured entries
    // by bare name-slug but looked them up by `base.key` (which carries the
    // `srd_` document prefix), so the join silently failed for every entry.
    const slugSet = new Set(["srd_wand-of-magic-missiles"]);
    const structured = await readStructuredRules({
      kind: "magicitems",
      edition: "2014",
      rootPath: SR_PATH!,
      slugSet,
    });
    const rule: MergeRule = { kind: "magicitem", pickOverlay: () => null };
    const result = mergeKind(rule, {
      edition: "2014",
      kind: "magicitem",
      open5e: [{ key: "srd_wand-of-magic-missiles", name: "Wand of Magic Missiles" }],
      structured,
      activation: new Map(),
      overlay: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0].structured).not.toBeNull();
    expect((result[0].structured as Record<string, unknown>).charges).toBe(7);
    expect((result[0].structured as Record<string, unknown>).attachedSpells).toBeDefined();
  });
});
