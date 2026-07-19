/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderCastView } from "../packages/obsidian/src/modules/pc/components/spells/cast-view";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedSpell, DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import { toggleSpellBlock } from "../packages/obsidian/src/modules/pc/components/spells/spell-block-expand";

// Stub the block renderer so the expand wiring can be asserted without the async spell-block render.
vi.mock("../packages/obsidian/src/modules/pc/components/spells/spell-block-expand", () => ({ toggleSpellBlock: vi.fn() }));

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
  return { resolved, derived, services: {} as never, app: {} as never, editState: editState as never };
}

describe("renderCastView", () => {
  it("renders slot boxes per leveled section and a row per prepared spell", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Magic Missile", 1), sp("Hold Person", 2)]));
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(7); // 4 + 3
    const names = [...root.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).toContain("Magic Missile");
    expect(names).toContain("Hold Person");
  });

  it("leveled rows have a CAST button; the cast button casts at the row's level", () => {
    const root = mountContainer();
    const castSpell = vi.fn();
    renderCastView(root, ctxFor([sp("Hold Person", 2)], { castSpell, castCantrip: vi.fn(), expendSlot: vi.fn(), restoreSlot: vi.fn() }));
    const btn = root.querySelector(".pc-spell-castbtn") as HTMLElement;
    expect(btn.textContent).toBe("CAST");
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(castSpell).toHaveBeenCalledWith("hold-person", 2);
  });

  it("cantrips show an At Will marker, no CAST button, and no slot boxes", () => {
    const root = mountContainer();
    const ctx = ctxFor([sp("Fire Bolt", 0)]);
    // A real cantrip-only caster owns no leveled slots.
    (ctx.derived as never as { derivedSpellSlots: Record<number, number> }).derivedSpellSlots = {};
    renderCastView(root, ctx);
    expect(root.querySelector(".pc-spell-atwill")).not.toBeNull();
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.querySelector(".pc-spell-castbtn")).toBeNull();
  });

  it("repeats a scaling spell under higher levels with an upcast badge + scaled value", () => {
    const root = mountContainer();
    const mm = sp("Magic Missile", 1, { casting_options: [{ type: "slot_level_2", target_count: 4 }] as never });
    renderCastView(root, ctxFor([mm]));
    expect(root.querySelectorAll(".pc-spell-up").length).toBe(1);
    expect(root.querySelector(".pc-spell-up")?.textContent).toContain("↑ 2nd");
    expect(root.textContent).toContain("4 targets");
  });

  it("does not repeat a non-scaling spell", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Shield", 1)]));
    expect(root.querySelectorAll(".pc-spell-up").length).toBe(0);
  });

  it("shows TIME, RANGE, the save DC, and the damage type from real fields", () => {
    const root = mountContainer();
    // A genuine save spell (NOT a curated attack-roll spell) so the Hit/DC cell
    // renders the save ability + DC rather than an "Atk +N" to-hit.
    const fb = sp("Burning Hands", 2, {
      casting_time: "action", range: "120 feet",
      saving_throw: { ability: "dexterity" } as never, damage: { types: ["fire"] } as never,
    });
    renderCastView(root, ctxFor([fb]));
    expect(root.textContent).toContain("1A");
    expect(root.textContent).toContain("120 ft");
    expect(root.textContent).toContain("DEX");
    expect(root.textContent).toContain("15");   // saveDC from derived
    expect(root.textContent?.toLowerCase()).toContain("fire");
  });

  it("renders C and R markers from concentration/ritual", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Hold Person", 2, { concentration: true, ritual: false } as never)]));
    const marks = [...root.querySelectorAll(".pc-spell-cr")].map((m) => m.textContent);
    expect(marks).toContain("C");
  });

  it("expands the reference block as a full-width sibling <div> below the row, and toggles off", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Hold Person", 2)]));
    const row = root.querySelector(".pc-spell-cast-row") as HTMLElement;
    (row.querySelector(".pc-spell-namecell") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const expand = root.querySelector(".pc-spell-expand-row") as HTMLElement;
    expect(expand).not.toBeNull();
    expect(expand.tagName).toBe("DIV");
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    expect(root.querySelector("table")).toBeNull();
    // the block mounts into the expand div itself — NOT a table cell
    expect(toggleSpellBlock).toHaveBeenCalledWith(expand, expect.anything(), expect.anything());
    // clicking the name again removes the expansion
    (row.querySelector(".pc-spell-namecell") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.querySelector(".pc-spell-expand-row")).toBeNull();
  });

  it("toggles .pc-row-open on the spell row and tints the sibling expand", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Hold Person", 2)]));
    const row = root.querySelector(".pc-spell-cast-row") as HTMLElement;
    expect(row.classList.contains("pc-row-open")).toBe(false);
    const name = row.querySelector(".pc-spell-namecell") as HTMLElement;
    name.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row.classList.contains("pc-row-open")).toBe(true);
    // the sibling expand carries the shared open tint so row + block read as one unit
    const expand = root.querySelector(".pc-spell-expand-row") as HTMLElement;
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    name.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row.classList.contains("pc-row-open")).toBe(false);
  });
});

// ---- pact casters ----
function pactSp(name: string, level: number): ResolvedSpell {
  return { entity: { name, level } as never, slug: name.toLowerCase().replace(/\s+/g, "-"),
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
  return { resolved, derived, services: {} as never, app: {} as never, editState: editState as never };
}

describe("renderCastView — pact casters", () => {
  it("renders pact leveled spells as rows; cast via castPactSpell(slug)", () => {
    const root = mountContainer();
    const castPactSpell = vi.fn();
    renderCastView(root, ctxForPact([pactSp("Hex", 1)], { castPactSpell, castCantrip: vi.fn(), castSpell: vi.fn(), expendPactSlot: vi.fn(), restorePactSlot: vi.fn() }));
    const rows = [...root.querySelectorAll(".pc-spell-cast-row")];
    const hexRow = rows.find((r) => r.querySelector(".pc-spell-name")?.textContent === "Hex")!;
    (hexRow.querySelector(".pc-spell-castbtn") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(castPactSpell).toHaveBeenCalledWith("hex");
  });

  it("disables the pact cast button when no pact slot remains", () => {
    const root = mountContainer();
    const ctx = ctxForPact([pactSp("Hex", 1)], { castPactSpell: vi.fn() });
    (ctx.resolved.state as never as { spell_slots_pact: { used: number; total: number; level: number } }).spell_slots_pact = { level: 1, used: 1, total: 1 };
    renderCastView(root, ctx);
    const hexRow = [...root.querySelectorAll(".pc-spell-cast-row")].find((r) => r.querySelector(".pc-spell-name")?.textContent === "Hex")!;
    expect(hexRow.querySelector(".pc-spell-castbtn.disabled")).not.toBeNull();
  });
});

// ---- known casters ----
function knownCtx(spells: ResolvedSpell[]): ComponentRenderContext {
  const resolved = {
    definition: { name: "Tess", spells: { known: [], overrides: [] }, overrides: {} } as never,
    state: { spell_slots: {}, spell_slots_pact: undefined, concentration: null } as never,
    spells,
  } as unknown as ResolvedCharacter;
  const derived = {
    spellcastingClasses: [{ classSlug: "sorcerer", className: "Sorcerer", ability: "cha", saveDC: 14, attackBonus: 6, casterType: "full", preparation: "known" }],
    derivedSpellSlots: { 1: 4, 2: 3 }, pactMagic: null, spellLimits: [],
  } as unknown as DerivedStats;
  return { resolved, derived, services: {} as never, app: {} as never, editState: null as never };
}
function sorcSp(name: string, level: number, prepared: boolean): ResolvedSpell {
  return { entity: { name, level } as never, slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: "sorcerer", source: "class", prepared, alwaysPrepared: false };
}

describe("renderCastView — known casters", () => {
  it("shows known-caster leveled spells even when prepared is false", () => {
    const root = mountContainer();
    renderCastView(root, knownCtx([sorcSp("Magic Missile", 1, false), sorcSp("Shatter", 2, false)]));
    const names = [...root.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).toContain("Magic Missile");
    expect(names).toContain("Shatter");
  });

  it("still hides an unprepared spell for a PREPARED caster", () => {
    const root = mountContainer();
    renderCastView(root, ctxFor([sp("Sleet Storm", 2, {}, /*prepared*/ false)]));
    const names = [...root.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).not.toContain("Sleet Storm");
  });
});

// ---- scrolls & consumables (P4 Task 6) ----
// An item-granted spell (a Spell Scroll: source "item", carrying entryIndex) is
// cast by CONSUMING the item, never by spending a slot. It lives ONLY in the
// "Scrolls & Consumables" section and must not leak into the cantrip/owned/pact
// sections that filter class + feat spells.
function itemSp(
  name: string, level: number, entryIndex: number,
  opts: { ability?: string; extra?: Partial<ResolvedSpell["entity"]> } = {},
): ResolvedSpell {
  return {
    entity: { name, level, ...opts.extra } as never,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: null, source: "item", prepared: true, alwaysPrepared: true,
    ability: opts.ability as never, entryIndex,
  };
}
function ctxForScroll(spells: ResolvedSpell[], editState: unknown = null, derivedOver: Record<string, unknown> = {}): ComponentRenderContext {
  const resolved = {
    definition: { name: "Tordek", edition: "2014", spells: { known: [], overrides: [] }, equipment: [], overrides: {} } as never,
    state: { spell_slots: {}, spell_slots_pact: undefined, concentration: null } as never,
    spells,
  } as unknown as ResolvedCharacter;
  const derived = {
    spellcastingClasses: [{ classSlug: "wizard", className: "Wizard", ability: "int", saveDC: 15, attackBonus: 7, casterType: "full", preparation: "prepared" }],
    derivedSpellSlots: { 1: 4, 2: 3, 3: 2 }, pactMagic: null, spellLimits: [],
    abilitySpellcasting: { int: { saveDC: 15, attackBonus: 7 } },
    ...derivedOver,
  } as unknown as DerivedStats;
  return { resolved, derived, services: {} as never, app: {} as never, editState: editState as never };
}
// Find the .pc-spell-cast-table body that follows the section head whose label matches.
function sectionTableAfter(root: HTMLElement, label: string): HTMLElement {
  const sec = [...root.querySelectorAll(".pc-spell-sec")].find(
    (s) => s.querySelector(".pc-spell-sec-label")?.textContent === label,
  )!;
  let el = sec.nextElementSibling;
  while (el && !el.classList.contains("pc-spell-cast-table")) el = el.nextElementSibling;
  return el as HTMLElement;
}

describe("renderCastView · scrolls & consumables", () => {
  it("renders a Scrolls & Consumables section with the scroll row, without leaking it into the owned-level section", () => {
    const root = mountContainer();
    // A Wizard who KNOWS Fireball at L3 and also carries a Fireball scroll (entry 0).
    renderCastView(root, ctxForScroll([
      sp("Fireball", 3, { saving_throw: { ability: "dexterity" } } as never),
      itemSp("Fireball", 3, 0, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } }),
    ]));

    // The section exists.
    const labels = [...root.querySelectorAll(".pc-spell-sec-label")].map((l) => l.textContent);
    expect(labels).toContain("Scrolls & Consumables");

    // The scroll row lives in the Scrolls section, with a "Cast (consume)" action.
    const scrollBody = sectionTableAfter(root, "Scrolls & Consumables");
    expect([...scrollBody.querySelectorAll(".pc-spell-name")].map((n) => n.textContent)).toContain("Fireball");
    expect(scrollBody.textContent).toContain("Cast (consume)");
    expect(scrollBody.querySelector(".pc-spell-scroll")).not.toBeNull();

    // The owned 3rd-level section shows ONLY the class copy, never a second (item) Fireball row.
    const l3Body = sectionTableAfter(root, "3rd Level");
    const l3Fireballs = [...l3Body.querySelectorAll(".pc-spell-name")].filter((n) => n.textContent === "Fireball");
    expect(l3Fireballs.length).toBe(1);
    expect(l3Body.textContent).not.toContain("Cast (consume)");

    // Exactly one consume action across the whole view.
    expect([...root.querySelectorAll("button")].filter((b) => b.textContent === "Cast (consume)").length).toBe(1);
  });

  it("does not leak an item cantrip into the Cantrips section", () => {
    const root = mountContainer();
    renderCastView(root, ctxForScroll([
      sp("Fire Bolt", 0),
      itemSp("Fire Bolt", 0, 1, { ability: "int" }),
    ]));
    const cantripBody = sectionTableAfter(root, "Cantrips");
    // Only the class cantrip renders under Cantrips (the scroll cantrip is filtered out).
    expect([...cantripBody.querySelectorAll(".pc-spell-name")].filter((n) => n.textContent === "Fire Bolt").length).toBe(1);
    expect(cantripBody.textContent).not.toContain("Cast (consume)");
    // The scroll copy surfaces under Scrolls & Consumables.
    expect(sectionTableAfter(root, "Scrolls & Consumables").textContent).toContain("Cast (consume)");
  });

  it("Cast (consume) consumes the scroll by entryIndex and never expends a slot", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    const expendSlot = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll, expendSlot, castSpell: vi.fn(), restoreSlot: vi.fn() },
    ));
    const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === "Cast (consume)")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(consumeScroll).toHaveBeenCalledWith(2);
    expect(expendSlot).not.toHaveBeenCalled();
  });

  it("a no-ability scroll (non-caster) shows the INT/WIS/CHA capture control in place of a DC cell", () => {
    const root = mountContainer();
    const setEquipmentOverride = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 0, { extra: { saving_throw: { ability: "dexterity" } } })], // no ability
      { setEquipmentOverride, consumeScroll: vi.fn() },
      { spellcastingClasses: [], derivedSpellSlots: {}, abilitySpellcasting: {} },
    ));
    const row = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    const control = row.querySelector(".pc-scroll-ability");
    expect(control).not.toBeNull();
    // The DC cell is NOT rendered for a no-ability scroll row.
    expect(row.querySelector(".pc-spell-hitdc")).toBeNull();
    // Picking WIS writes the per-instance spell_ability on the originating entry.
    const wis = [...control!.querySelectorAll("button")].find((b) => b.textContent === "WIS")!;
    wis.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(setEquipmentOverride).toHaveBeenCalledWith(0, { spell_ability: "wis" });
  });
});
