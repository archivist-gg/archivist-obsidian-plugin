import { describe, it, expect } from "vitest";
import { tabDeclSchema } from "@archivist-gg/dnd5e/schemas/selection-pool-schema";

describe("tabDeclSchema.renders.layout", () => {
  it("accepts a layout hint", () => {
    const t = tabDeclSchema.parse({ id: "boons", label: "Boons", renders: { pool: "p", layout: "blocks" } });
    expect(t.renders.layout).toBe("blocks");
  });
  it("omitting layout leaves it undefined (renderer applies the default)", () => {
    const t = tabDeclSchema.parse({ id: "boons", label: "Boons", renders: { pool: "p" } });
    expect(t.renders.layout).toBeUndefined();
  });
  it("rejects an unknown layout", () => {
    expect(() => tabDeclSchema.parse({ id: "boons", label: "Boons", renders: { pool: "p", layout: "nope" } })).toThrow();
  });
});
