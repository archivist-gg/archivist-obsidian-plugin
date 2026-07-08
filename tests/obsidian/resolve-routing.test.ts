import { describe, it, expect } from "vitest";
import { createArchivist } from "@archivist/core";
import { dnd5ePack } from "@archivist/dnd5e";
const body = "name: Goblin\ncr: '1/4'\n";
const doc = { type: "monster", frontmatter: {}, body, raw: body };
describe("M3 resolve-routing", () => {
  const a = createArchivist({ storage: {} as any, content: { lookup: () => undefined } });
  a.registerPack(dnd5ePack);
  it("view path: resolve() carries derived proficiency_bonus", () => {
    const r = a.resolve(doc);
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as any).proficiency_bonus).toBe(2);
  });
  it("edit/save path: codec output omits the derived field", () => {
    const r = a.getEntityType("monster")!.doc!.parse(doc);
    expect(r.success).toBe(true);
    if (r.success) expect((r.data as any).proficiency_bonus).toBeUndefined();
  });
});
