/** @vitest-environment jsdom */

import { describe, it, expect } from "vitest";
import { weaponModule } from "../src/modules/weapon/weapon.module";
import { LONGSWORD } from "./fixtures/weapon";

describe("weaponModule integration", () => {
  it("declares the expected ArchivistModule fields", () => {
    expect(weaponModule.id).toBe("weapon");
    expect(weaponModule.codeBlockType).toBe("weapon");
    expect(weaponModule.entityType).toBe("weapon");
  });

  it("parseYaml dispatches to parseWeapon", () => {
    const r = weaponModule.parseYaml!(LONGSWORD);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slug).toBe("longsword");
  });

  it("render produces a wrapped element", () => {
    const r = weaponModule.parseYaml!(LONGSWORD);
    if (!r.success) throw new Error(r.error);
    const host = document.createElement("div");
    const result = weaponModule.render!(host, r.data, {} as never);
    expect(result.classList.contains("archivist-item-block-wrapper")).toBe(true);
  });
});
