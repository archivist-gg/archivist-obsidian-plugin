import { describe, it, expect } from "vitest";
import { createArchivist } from "@core/kernel";
import type { EntityType, StoragePort, ContentLookupPort } from "@core/contracts";

const noStorage: StoragePort = {
  listFolder: async () => [], read: async () => "", write: async () => {},
  ensureFolder: async () => {}, exists: async () => false,
};
const content: ContentLookupPort = { lookup: (t, s) => (t === "thing" && s === "a" ? { slug: "a" } : undefined) };

const thing: EntityType = {
  type: "thing",
  doc: { parse: (d) => ({ success: true, data: { body: d.body } }), serialize: (r: any) => r.body },
  resolve: (raw: any, ctx) => ({ raw, ref: ctx.lookup("thing", "a") }),
};

describe("createArchivist", () => {
  const a = createArchivist({ storage: noStorage, content });
  a.registerPack({ id: "t", version: "0", conventionVersion: "1.0", entityTypes: [thing] });

  it("resolves a doc through the owning entity type and injects the lookup context", () => {
    const doc = a.parseContainer("```thing\nhello\n```");
    expect(doc.success).toBe(true);
    if (!doc.success) return;
    const r = a.resolve(doc.data) as any;
    expect(r.success).toBe(true);
    expect(r.data.ref).toEqual({ slug: "a" });
  });

  it("returns identity data when an entity type has no resolve", () => {
    a.registerPack({ id: "t2", version: "0", conventionVersion: "1.0",
      entityTypes: [{ type: "plain", doc: { parse: (d) => ({ success: true, data: d.body }), serialize: (r: any) => r } }] });
    const doc = a.parseContainer("```plain\nx\n```");
    const r = a.resolve((doc as any).data) as any;
    expect(r.data).toBe("x\n");
  });

  it("delegates lookup to the content port", () => {
    expect(a.lookup("thing", "a")).toEqual({ slug: "a" });
  });
});
