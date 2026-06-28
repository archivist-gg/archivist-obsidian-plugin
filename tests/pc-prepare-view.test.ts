/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderPrepareView } from "../packages/obsidian/src/modules/pc/components/spells/prepare-view";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedSpell } from "../packages/obsidian/src/modules/pc/pc.types";

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

  it("renders a Level filter chip row and narrows the list when a level is chosen", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Fire Bolt", 0, true), sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    const chips = [...root.querySelectorAll(".pc-spell-fchip")].map((c) => c.textContent);
    expect(chips).toContain("All");
    expect(chips).toContain("Cantrip");
    expect(chips).toContain("1st");
    // click "1st" → only the 1st-level spell row remains
    const oneSt = [...root.querySelectorAll(".pc-spell-fchip")].find((c) => c.textContent === "1st") as HTMLElement;
    oneSt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const names = [...root.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).toContain("Magic Missile");
    expect(names).not.toContain("Fire Bolt");
  });

  it("hides the Class filter row for a single-class caster", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    expect(root.querySelector(".pc-spell-fchip-class")).toBeNull();
  });

  it("shows the edition source tag on each row", () => {
    const root = mountContainer();
    const s = sp("Magic Missile", 1, true);
    (s.entity as never as { edition: string }).edition = "2014";
    renderPrepareView(root, ctx([s], { togglePrepared: vi.fn() }));
    const tag = root.querySelector(".pc-spell-srctag");
    expect(tag?.textContent).toBe("5e"); // 2014 edition is labelled "5e"
  });

  it("expands the spell block BELOW the row (block-level host), not beside the title", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    const host = root.querySelector(".pc-spell-prep-row-host") as HTMLElement;
    const row = root.querySelector(".pc-spell-prep-row") as HTMLElement;
    expect(host).toBeTruthy();
    expect(row).toBeTruthy();
    // Click the name to open the reference block.
    (root.querySelector(".pc-spell-namewrap") as HTMLElement)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const expand = root.querySelector(".pc-spell-expand") as HTMLElement;
    // The container is created synchronously (markdown fills in async).
    expect(expand).toBeTruthy();
    // It must NOT be a direct child of the flex row (that lands it beside the title).
    expect(row.querySelector(":scope > .pc-spell-expand")).toBeNull();
    // It MUST be a direct child of the block-level host, sitting AFTER the flex row.
    expect(host.querySelector(":scope > .pc-spell-expand")).toBe(expand);
    expect(expand.parentElement).toBe(host);
    expect(expand.previousElementSibling).toBe(row);
  });

  it("tints the block-level host (one layer) when the name opens/closes the block", () => {
    const root = mountContainer();
    renderPrepareView(root, ctx([sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    const row = root.querySelector(".pc-spell-prep-row") as HTMLElement;
    const host = root.querySelector(".pc-spell-prep-row-host") as HTMLElement;
    expect(host.classList.contains("pc-open-expand")).toBe(false);
    const nameWrap = root.querySelector(".pc-spell-namewrap") as HTMLElement;
    nameWrap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // ONLY the host carries the tint (one translucent layer over row + card);
    // the row must NOT also be tinted or its shade would darken vs the expand.
    expect(host.classList.contains("pc-open-expand")).toBe(true);
    expect(row.classList.contains("pc-row-open")).toBe(false);
    nameWrap.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(host.classList.contains("pc-open-expand")).toBe(false);
  });

  it("resets the level filter on a full re-render (no stale filter across characters/modes)", () => {
    const root1 = mountContainer();
    renderPrepareView(root1, ctx([sp("Fire Bolt", 0, true), sp("Magic Missile", 1, true)], { togglePrepared: vi.fn() }));
    // Filter character A to 1st-level only.
    const oneSt = [...root1.querySelectorAll(".pc-spell-fchip")].find((c) => c.textContent === "1st") as HTMLElement;
    oneSt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect([...root1.querySelectorAll(".pc-spell-name")].map((n) => n.textContent)).not.toContain("Fire Bolt");
    // A full re-render (e.g. switching to a cantrip-only character) must NOT carry the stale "1st" filter.
    const root2 = mountContainer();
    renderPrepareView(root2, ctx([sp("Fire Bolt", 0, true)], { togglePrepared: vi.fn() }));
    expect([...root2.querySelectorAll(".pc-spell-name")].map((n) => n.textContent)).toContain("Fire Bolt");
  });
});
