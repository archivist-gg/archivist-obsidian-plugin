/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { armorModule } from "../src/modules/armor/armor.module";
import { PLATE } from "./fixtures/armor";

describe("armorModule integration", () => {
  it("declares the expected ArchivistModule fields", () => {
    expect(armorModule.id).toBe("armor");
    expect(armorModule.codeBlockType).toBe("armor");
    expect(armorModule.entityType).toBe("armor");
    expect(typeof armorModule.parseYaml).toBe("function");
    expect(typeof armorModule.render).toBe("function");
  });

  it("parseYaml on the module dispatches to the same parser as direct parsing", () => {
    const direct = armorModule.parseYaml!(PLATE);
    expect(direct.success).toBe(true);
    if (direct.success) {
      expect(direct.data.slug).toBe("plate");
    }
  });

  it("render produces a wrapped element", () => {
    const direct = armorModule.parseYaml!(PLATE);
    if (!direct.success) throw new Error(direct.error);
    const host = document.createElement("div");
    const result = armorModule.render!(host, direct.data, {} as never);
    expect(result.classList.contains("archivist-item-block-wrapper")).toBe(true);
    expect(host.contains(result)).toBe(true);
  });
});
