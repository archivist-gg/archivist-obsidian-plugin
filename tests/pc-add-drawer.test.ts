/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderAddDrawer } from "../src/modules/pc/components/spells/add-drawer";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

const REG = buildMockRegistry([
  { slug: "fireball", name: "Fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"] } },
  { slug: "cure-wounds", name: "Cure Wounds", entityType: "spell", data: { name: "Cure Wounds", level: 1, classes: ["cleric"] } },
]);

function ctx(addKnownSpell = vi.fn()): ComponentRenderContext {
  return {
    resolved: { spells: [] } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 3: 1 }, pactMagic: null } as never,
    core: { entities: REG } as never, app: {} as never, editState: { addKnownSpell } as never,
  };
}

describe("renderAddDrawer", () => {
  it("lists class candidates and adds on ＋ click", () => {
    const root = mountContainer();
    const addKnownSpell = vi.fn();
    renderAddDrawer(root, ctx(addKnownSpell));
    const names = [...root.querySelectorAll(".pc-add-row-name")].map((n) => n.textContent);
    expect(names).toContain("Fireball");      // wizard class match
    expect(names).not.toContain("Cure Wounds"); // cleric, filtered out
    (root.querySelector(".pc-add-row-btn") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(addKnownSpell).toHaveBeenCalledWith("fireball", { class: "wizard" });
  });
});
