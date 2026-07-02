/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { armorModule } from "../packages/obsidian/src/modules/armor/armor.module";
import { parseArmor } from "@archivist/dnd5e/armor/armor.parser";
import { PLATE } from "./fixtures/armor";

describe("armorModule integration", () => {
  it("declares the EntityPresenter shape (0f)", () => {
    expect(armorModule.type).toBe("armor");
    expect(typeof armorModule.render).toBe("function");
  });

  it("the pack parser handles the same fixture the presenter renders", () => {
    const direct = parseArmor(PLATE);
    expect(direct.success).toBe(true);
    if (direct.success) {
      expect(direct.data.slug).toBe("plate");
    }
  });

  it("render produces a wrapped element", () => {
    const direct = parseArmor(PLATE);
    if (!direct.success) throw new Error(direct.error);
    const host = document.createElement("div");
    const result = armorModule.render(host, direct.data, {} as never);
    expect(result).toBeTruthy();
    expect((result as HTMLElement).classList.contains("archivist-item-block-wrapper")).toBe(true);
    expect(host.contains(result as HTMLElement)).toBe(true);
  });
});
