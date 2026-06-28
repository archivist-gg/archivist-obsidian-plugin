import { describe, it, expect } from "vitest";
import { moduleToEntityType } from "@/adapter/legacy-adapter";
import type { ArchivistModule } from "@/core/module-api";

const mod: Partial<ArchivistModule> = {
  id: "demo",
  codeBlockType: "demo",
  parseYaml: (src) => ({ success: true, data: { src } }),
};

describe("moduleToEntityType", () => {
  it("wraps parseYaml as EntityType.doc.parse over the doc body", () => {
    const et = moduleToEntityType(mod as ArchivistModule);
    expect(et.type).toBe("demo");
    const r = et.doc!.parse({ type: "demo", frontmatter: {}, body: "hello", raw: "" });
    expect(r).toEqual({ success: true, data: { src: "hello" } });
  });

  it("serialize via the legacy adapter throws (not supported pre-migration)", () => {
    const et = moduleToEntityType(mod as ArchivistModule);
    expect(() => et.doc!.serialize({})).toThrow(/legacy adapter/);
  });
});
