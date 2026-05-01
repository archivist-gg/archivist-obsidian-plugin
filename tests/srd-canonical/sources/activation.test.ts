import { describe, it, expect } from "vitest";
import { readActivationData } from "../../../tools/srd-canonical/sources/activation";
import * as path from "node:path";

const fixtureRoot = path.resolve(__dirname, "../fixtures/structured-rules");

describe("activation reader", () => {
  it("matches against Open5e prefixed key shape (srd_<slug>) for 2014 and stores result by prefixed key", async () => {
    const result = await readActivationData({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(["srd_polearm-master"]),
    });
    expect(result.size).toBe(1);
    const entry = result.get("srd_polearm-master");
    expect(entry).toBeDefined();
    expect(entry?.activation?.type).toBe("bonus");
  });

  it("matches against Open5e 2024 prefix shape (srd-2024_<slug>) and stores by that key", async () => {
    const result = await readActivationData({
      kind: "feats",
      edition: "2024",
      rootPath: fixtureRoot,
      slugSet: new Set(["srd-2024_polearm-master"]),
    });
    expect(result.size).toBe(1);
    const entry = result.get("srd-2024_polearm-master");
    expect(entry).toBeDefined();
    expect(entry?.activation?.type).toBe("bonus");
  });

  it("returns empty when slug set has no matching prefixed keys (bare slug must NOT match)", async () => {
    const result = await readActivationData({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(["polearm-master"]),
    });
    expect(result.size).toBe(0);
  });

  it("returns empty map when foundry file absent", async () => {
    const result = await readActivationData({
      kind: "spells",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(["srd_fireball"]),
    });
    expect(result.size).toBe(0);
  });

  it.skipIf(!process.env.STRUCTURED_RULES_PATH)(
    "reads activities from top-level e.activities (not e.system.activities) against the real 5etools dump",
    async () => {
      const realRoot = process.env.STRUCTURED_RULES_PATH!;
      // 2024 feats whose foundry-feats.json entries have non-empty activation.type at top level.
      const slugSet = new Set([
        "srd-2024_polearm-master",
        "srd-2024_healer",
        "srd-2024_defensive-duelist",
        "srd-2024_tavern-brawler",
      ]);
      const result = await readActivationData({
        kind: "feats",
        edition: "2024",
        rootPath: realRoot,
        slugSet,
      });
      // Precise pin: Polearm Master is stable in the dump and its activation type is "bonus".
      expect(result.get("srd-2024_polearm-master")?.activation?.type).toBe("bonus");
      // Soft sanity check: at least one of the candidates has a string activation type.
      let foundOne = false;
      for (const entry of result.values()) {
        if (entry?.activation?.type) {
          foundOne = true;
          expect(typeof entry.activation.type).toBe("string");
        }
      }
      expect(foundOne).toBe(true);
    },
  );
});
