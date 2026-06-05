import { describe, it, expect } from "vitest";
import { resourceSchema } from "../src/shared/schemas/resource-schema";

describe("resourceSchema scales_at + consumes", () => {
  it("accepts a resource with scales_at and consumes", () => {
    const ok = resourceSchema.safeParse({
      id: "barbarian:rage",
      name: "Rage",
      max_formula: "2",
      scales_at: [{ level: 3, max: "3" }, { level: 20, max: "999" }],
      reset: "long-rest",
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.scales_at?.length).toBe(2);

    const linked = resourceSchema.safeParse({
      id: "paladin:sacred-weapon",
      name: "Sacred Weapon",
      max_formula: "1",
      reset: "short-rest",
      consumes: { resource: "paladin:channel-divinity", amount: 1 },
    });
    expect(linked.success).toBe(true);
    expect(linked.success && linked.data.consumes?.resource).toBe("paladin:channel-divinity");
  });

  it("rejects a scales_at step missing max", () => {
    const bad = resourceSchema.safeParse({
      id: "x:y", name: "Y", max_formula: "1", reset: "long-rest",
      scales_at: [{ level: 3 }],
    });
    expect(bad.success).toBe(false);
  });
});
