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

function pactSp(name: string, level: number, extra: Partial<ResolvedSpell["entity"]> = {}): ResolvedSpell {
  return { entity: { name, level, ...extra } as never, slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: "warlock", source: "class", prepared: true, alwaysPrepared: false };
}
function ctxForPact(spells: ResolvedSpell[], editState: unknown = null): ComponentRenderContext {
  const resolved = {
    definition: { name: "Bram", spells: { known: [], overrides: [] }, overrides: {} } as never,
    state: { spell_slots: {}, spell_slots_pact: { level: 1, used: 0, total: 1 }, concentration: null } as never,
    spells,
  } as unknown as ResolvedCharacter;
  const derived = {
    spellcastingClasses: [{ classSlug: "warlock", className: "Warlock", ability: "cha", saveDC: 13, attackBonus: 5, casterType: "pact", preparation: "known" }],
    derivedSpellSlots: {}, pactMagic: { level: 1, total: 1 }, spellLimits: [],
  } as unknown as DerivedStats;
  return { resolved, derived, core: {} as never, app: {} as never, editState: editState as never };
}

describe("renderCastView — pact casters", () => {
  it("renders pact leveled spells as cast rows under the Pact Magic section", () => {
    const root = mountContainer();
    renderCastView(root, ctxForPact([pactSp("Eldritch Blast", 0), pactSp("Hex", 1)]));
    const rows = [...root.querySelectorAll(".pc-spell-cast-row")];
    const hexRow = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "Hex");
    expect(hexRow).toBeTruthy();                 // Hex (leveled) appears as a cast row
    // Eldritch Blast is a cantrip → it stays in the Cantrips section, with a ghost pill
    expect(root.querySelector(".pc-spell-castpill.ghost")).not.toBeNull();
  });

  it("pact cast pill casts via editState.castPactSpell(slug)", () => {
    const root = mountContainer();
    const castPactSpell = vi.fn();
    renderCastView(root, ctxForPact([pactSp("Hex", 1)], { castPactSpell, castCantrip: vi.fn(), castSpell: vi.fn(), expendPactSlot: vi.fn(), restorePactSlot: vi.fn() }));
    const rows = [...root.querySelectorAll(".pc-spell-cast-row")];
    const hexRow = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "Hex")!;
    (hexRow.querySelector(".pc-spell-castpill") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(castPactSpell).toHaveBeenCalledWith("hex");   // no level arg
  });

  it("disables the pact cast pill when no pact slot remains", () => {
    const root = mountContainer();
    const ctx = ctxForPact([pactSp("Hex", 1)], { castPactSpell: vi.fn() });
    (ctx.resolved.state as never as { spell_slots_pact: { used: number; total: number; level: number } }).spell_slots_pact = { level: 1, used: 1, total: 1 };
    renderCastView(root, ctx);
    const rows = [...root.querySelectorAll(".pc-spell-cast-row")];
    const hexRow = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "Hex")!;
    expect(hexRow.querySelector(".pc-spell-castpill.disabled")).not.toBeNull();
  });
});
