/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderPrepareView } from "../src/modules/pc/components/spells/prepare-view";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedSpell } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());
const REG = buildMockRegistry([{ slug: "fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"] } }]);

function sp(name: string, level: number, prepared: boolean, alwaysPrepared = false): ResolvedSpell {
  return { entity: { name, level } as never, slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: "wizard", source: "class", prepared, alwaysPrepared };
}
function ctx(spells: ResolvedSpell[], editState: unknown, preparation: "prepared" | "known" = "prepared"): ComponentRenderContext {
  return {
    resolved: { definition: { spells: { known: [] } } as never, state: {} as never, spells },
    derived: {
      spellcastingClasses: [{ classSlug: "wizard", className: "Wizard", ability: "int", saveDC: 15, attackBonus: 7, casterType: "full", preparation }],
      derivedSpellSlots: { 1: 4, 3: 2 }, pactMagic: null,
      spellLimits: [{ classSlug: "wizard", kind: "prepared", cantripsKnown: 5, preparedOrKnown: 8 }],
    } as never,
    core: { entities: REG } as never, app: {} as never, editState: editState as never,
  };
}

describe("renderPrepareView", () => {
  it("shows the prepared/cantrip counters", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    expect(root.querySelector(".pc-spell-counts")?.textContent).toContain("8");
    expect(root.querySelector(".pc-spell-counts")?.textContent).toContain("5");
  });

  it("prepared box toggles via editState.togglePrepared", () => {
    const root = mountContainer();
    const togglePrepared = vi.fn();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, false)], { togglePrepared }));
    (root.querySelector(".pc-spell-prep-row .archivist-toggle-box") as HTMLElement)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(togglePrepared).toHaveBeenCalledWith("magic-missile");
  });

  it("remove needs a confirming second click before calling removeKnownSpell", () => {
    const root = mountContainer();
    const removeKnownSpell = vi.fn();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, true)], { togglePrepared: vi.fn(), removeKnownSpell }));
    const rm = root.querySelector(".pc-spell-remove") as HTMLElement;
    rm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(removeKnownSpell).not.toHaveBeenCalled();           // first click = arm confirm
    rm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(removeKnownSpell).toHaveBeenCalledWith("magic-missile");
  });

  it("known casters render no prepared boxes (Manage mode)", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Fireball", 3, true)], { togglePrepared: vi.fn() }, "known"));
    expect(root.querySelector(".pc-spell-prep-row .archivist-toggle-box")).toBeNull();
  });
});
