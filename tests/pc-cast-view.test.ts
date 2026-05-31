/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderCastView } from "../src/modules/pc/components/spells/cast-view";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedSpell, DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function sp(name: string, level: number, extra: Partial<ResolvedSpell["entity"]> = {}, prepared = true): ResolvedSpell {
  return { entity: { name, level, ...extra } as never, slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: "wizard", source: "class", prepared, alwaysPrepared: false };
}

function ctxFor(spells: ResolvedSpell[], editState: unknown = null): ComponentRenderContext {
  const resolved = {
    definition: { name: "Tordek", spells: { known: [], overrides: [] }, overrides: {} } as never,
    state: { spell_slots: {}, spell_slots_pact: undefined, concentration: null } as never,
    spells,
  } as unknown as ResolvedCharacter;
  const derived = {
    spellcastingClasses: [{ classSlug: "wizard", className: "Wizard", ability: "int", saveDC: 15, attackBonus: 7, casterType: "full", preparation: "prepared" }],
    derivedSpellSlots: { 1: 4, 2: 3 }, pactMagic: null, spellLimits: [],
  } as unknown as DerivedStats;
  return { resolved, derived, core: {} as never, app: {} as never, editState: editState as never };
}

describe("renderCastView", () => {
  it("renders slot boxes per level and base rows for prepared spells", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Magic Missile", 1), sp("Hold Person", 2)]));
    // harmonized boxes: 4 (1st) + 3 (2nd) = 7
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(7);
    const names = [...root.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).toContain("Magic Missile");
    expect(names).toContain("Hold Person");
  });

  it("repeats a scaling spell under higher levels with an upcast badge", () => {
    const root = mountContainer();
    const mm = sp("Magic Missile", 1, { casting_options: [{ type: "slot_level_2", target_count: 4 }] as never });
    renderCastView(root, ctxFor([mm]));
    expect(root.querySelectorAll(".pc-spell-up").length).toBe(1); // one ↑ row at 2nd
    expect(root.textContent).toContain("4 targets");
  });

  it("does not repeat a non-scaling spell", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Shield", 1)]));
    expect(root.querySelectorAll(".pc-spell-up").length).toBe(0);
  });

  it("cast pill calls editState.castSpell at the row's level", () => {
    const root = mountContainer();
    const castSpell = vi.fn();
    renderCastView(root, ctxFor([sp("Hold Person", 2)], { castSpell, castCantrip: vi.fn(), expendSlot: vi.fn(), restoreSlot: vi.fn() }));
    const pill = root.querySelector(".pc-spell-castpill") as HTMLElement;
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(castSpell).toHaveBeenCalledWith("hold-person", 2);
  });

  it("cantrips show a ghost cast pill and no slot boxes section", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Fire Bolt", 0)]));
    expect(root.querySelector(".pc-spell-castpill.ghost")).not.toBeNull();
  });
});
