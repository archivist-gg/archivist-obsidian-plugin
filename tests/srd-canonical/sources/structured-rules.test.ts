import { describe, it, expect } from "vitest";
import { readStructuredRules } from "../../../tools/srd-canonical/sources/structured-rules";
import * as path from "node:path";

const fixtureRoot = path.resolve(__dirname, "../fixtures/structured-rules");

describe("structured-rules reader", () => {
  it("filters entries to the SRD slug set", async () => {
    const result = await readStructuredRules({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(["alert"]),
    });
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Alert");
  });

  it("returns empty when slug set is empty", async () => {
    const result = await readStructuredRules({
      kind: "feats",
      edition: "2014",
      rootPath: fixtureRoot,
      slugSet: new Set(),
    });
    expect(result).toEqual([]);
  });
});
