import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist/core";
import type { EntityDoc } from "@archivist/core";
const doc: EntityDoc = { type: "boom", frontmatter: {}, body: "name: x", raw: "name: x" };
describe("kernel.resolve error handling", () => {
  it("returns a ParseResult error when et.resolve throws", () => {
    const a = createArchivist({ storage: {} as any, content: { lookup: () => undefined } });
    a.registerPack({ id: "t", version: "0", conventionVersion: "1.0", entityTypes: [{
      type: "boom",
      doc: { parse: () => ({ success: true, data: { name: "x" } }), serialize: () => "" },
      resolve: () => { throw new Error("kaboom"); },
    }] });
    const r = a.resolve(doc);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("kaboom");
  });
});
