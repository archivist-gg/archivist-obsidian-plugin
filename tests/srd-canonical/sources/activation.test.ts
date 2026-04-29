import { describe, it, expect } from "vitest";
import { readActivationData } from "../../../tools/srd-canonical/sources/activation";
import * as path from "node:path";

describe("activation reader", () => {
  it("reads foundry-feats.json and indexes by slug", async () => {
    const result = await readActivationData({
      kind: "feats",
      edition: "2014",
      rootPath: path.resolve(__dirname, "../fixtures/structured-rules"),
      slugSet: new Set(["polearm-master"]),
    });
    expect(result.size).toBe(1);
    const entry = result.get("polearm-master");
    expect(entry).toBeDefined();
    expect(entry?.activation?.type).toBe("bonusaction");
  });

  it("returns empty map when foundry file absent", async () => {
    const result = await readActivationData({
      kind: "spells",
      edition: "2014",
      rootPath: path.resolve(__dirname, "../fixtures/structured-rules"),
      slugSet: new Set(["fireball"]),
    });
    expect(result.size).toBe(0);
  });
});
