/** @vitest-environment jsdom */

import { describe, it, expect } from "vitest";
import { weaponModule } from "../packages/obsidian/src/modules/weapon/weapon.module";
import { parseWeapon } from "@archivist/dnd5e/weapon/weapon.parser";
import { LONGSWORD } from "./fixtures/weapon";

describe("weaponModule integration", () => {
  it("declares the EntityPresenter shape (0f)", () => {
    expect(weaponModule.type).toBe("weapon");
    expect(typeof weaponModule.render).toBe("function");
  });

  it("the pack parser handles the same fixture the presenter renders", () => {
    const r = parseWeapon(LONGSWORD);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slug).toBe("longsword");
  });

  it("render produces a wrapped element", () => {
    const r = parseWeapon(LONGSWORD);
    if (!r.success) throw new Error(r.error);
    const host = document.createElement("div");
    const result = weaponModule.render(host, r.data, {} as never);
    expect((result as HTMLElement).classList.contains("archivist-item-block-wrapper")).toBe(true);
  });
});
