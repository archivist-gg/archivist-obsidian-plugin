import { describe, it, expect } from "vitest";
import { readStructuredRules } from "../../../tools/srd-canonical/sources/structured-rules";
import * as path from "node:path";

const fixtureRoot = path.resolve(__dirname, "../fixtures/structured-rules");

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
