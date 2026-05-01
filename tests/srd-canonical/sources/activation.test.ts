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
    expect(entry?.activation?.type).toBe("bonusaction");
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
    expect(entry?.activation?.type).toBe("bonusaction");
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
});
