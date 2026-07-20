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

// The scroll cast control in a given section body.
function scrollCastBtn(root: HTMLElement, label = "Scrolls & Consumables"): HTMLButtonElement {
  return sectionTableAfter(root, label).querySelector(".pc-spell-castbtn") as HTMLButtonElement;
}
function click(el: Element): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("renderCastView · scrolls & consumables", () => {
  it("scroll row reuses the real CAST button (not the retired lozenge) and shows no 'always' marker", () => {
    const root = mountContainer();
    // A Wizard who KNOWS Fireball at L3 and also carries a Fireball scroll (entry 0).
    renderCastView(root, ctxForScroll([
      sp("Fireball", 3, { saving_throw: { ability: "dexterity" } } as never),
      itemSp("Fireball", 3, 0, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } }),
    ]));

    // The section exists.
    const labels = [...root.querySelectorAll(".pc-spell-sec-label")].map((l) => l.textContent);
    expect(labels).toContain("Scrolls & Consumables");

    // The scroll row lives in the Scrolls section and uses the shared CAST button.
    const scrollBody = sectionTableAfter(root, "Scrolls & Consumables");
    const scrollRow = scrollBody.querySelector(".pc-spell-cast-row") as HTMLElement;
    expect([...scrollBody.querySelectorAll(".pc-spell-name")].map((n) => n.textContent)).toContain("Fireball");
    const castBtn = scrollRow.querySelector(".pc-spell-castbtn") as HTMLElement;
    expect(castBtn).not.toBeNull();
    expect(castBtn.textContent).toBe("CAST");
    // The retired bespoke lozenge and its label are gone everywhere.
    expect(root.querySelector(".pc-spell-scroll")).toBeNull();
    expect(root.textContent).not.toContain("Cast (consume)");
    // A consumable scroll must NOT show the "always" marker (alwaysPrepared is a
    // resolver castability flag, not an "always ready" claim here).
    expect(scrollRow.querySelector(".pc-spell-always")).toBeNull();

    // The owned 3rd-level section shows ONLY the class copy, never a second (item) Fireball row.
    const l3Body = sectionTableAfter(root, "3rd Level");
    const l3Fireballs = [...l3Body.querySelectorAll(".pc-spell-name")].filter((n) => n.textContent === "Fireball");
    expect(l3Fireballs.length).toBe(1);
  });

  it("still renders the 'always' marker for a non-scroll always-prepared spell (guard: only scrolls are suppressed)", () => {
    const root = mountContainer();
    const domain: ResolvedSpell = {
      entity: { name: "Bless", level: 1 } as never, slug: "bless",
      classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: true,
    };
    renderCastView(root, ctxForScroll([domain]));
    const l1Body = sectionTableAfter(root, "1st Level");
    expect(l1Body.querySelector(".pc-spell-always")).not.toBeNull();
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
    // Cantrips are At Will (no cast button); the scroll copy carries the CAST button.
    expect(cantripBody.querySelector(".pc-spell-castbtn")).toBeNull();
    expect(scrollCastBtn(root)).not.toBeNull();
  });

  it("clicking CAST ARMS the scroll (does not consume): the button becomes Consume and a cancel appears", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll, expendSlot: vi.fn(), castSpell: vi.fn(), restoreSlot: vi.fn() },
    ));
    const scrollRow = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    const btn = scrollCastBtn(root);
    // At rest the row carries no arming class.
    expect(scrollRow.classList.contains("pc-row-arming")).toBe(false);
    click(btn);
    // Armed, not consumed.
    expect(consumeScroll).not.toHaveBeenCalled();
    expect(btn.textContent).toBe("Consume");
    expect(btn.classList.contains("armed")).toBe(true);
    // The row is flagged arming so CSS can span the confirm across the name column
    // (the name hides for the confirm instant) instead of overlapping it.
    expect(scrollRow.classList.contains("pc-row-arming")).toBe(true);
    expect(root.querySelector(".pc-spell-castcancel")).not.toBeNull();
  });

  it("arming toggles .pc-row-arming across the full lifecycle (rest → arm → cancel → arm → consume)", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll },
    ));
    const row = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    const btn = scrollCastBtn(root);
    expect(row.classList.contains("pc-row-arming")).toBe(false);
    // Arm.
    click(btn);
    expect(row.classList.contains("pc-row-arming")).toBe(true);
    // Cancel reverts and removes the class.
    click(root.querySelector(".pc-spell-castcancel") as HTMLElement);
    expect(row.classList.contains("pc-row-arming")).toBe(false);
    // Re-arm, then consume: the class is removed after consuming too.
    click(btn);
    expect(row.classList.contains("pc-row-arming")).toBe(true);
    click(btn);
    expect(consumeScroll).toHaveBeenCalledWith(2);
    expect(row.classList.contains("pc-row-arming")).toBe(false);
  });

  it("clicking the armed Consume consumes the scroll by entryIndex and never expends a slot", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    const expendSlot = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll, expendSlot, castSpell: vi.fn(), restoreSlot: vi.fn() },
    ));
    const btn = scrollCastBtn(root);
    click(btn); // arm
    click(btn); // confirm
    expect(consumeScroll).toHaveBeenCalledWith(2);
    expect(expendSlot).not.toHaveBeenCalled();
    // Reverts to CAST and the cancel is gone after consuming.
    expect(btn.textContent).toBe("CAST");
    expect(btn.classList.contains("armed")).toBe(false);
    expect(root.querySelector(".pc-spell-castcancel")).toBeNull();
  });

  it("clicking the cancel reverts an armed scroll to CAST without consuming", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll },
    ));
    const btn = scrollCastBtn(root);
    click(btn); // arm
    const cancel = root.querySelector(".pc-spell-castcancel") as HTMLElement;
    click(cancel);
    expect(consumeScroll).not.toHaveBeenCalled();
    expect(btn.textContent).toBe("CAST");
    expect(btn.classList.contains("armed")).toBe(false);
    expect(root.querySelector(".pc-spell-castcancel")).toBeNull();
  });

  it("clicking elsewhere on the sheet reverts an armed scroll without consuming", () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll },
    ));
    const btn = scrollCastBtn(root);
    click(btn); // arm
    expect(btn.classList.contains("armed")).toBe(true);
    // A click anywhere outside the action cell reverts it.
    click(document.body);
    expect(consumeScroll).not.toHaveBeenCalled();
    expect(btn.textContent).toBe("CAST");
    expect(btn.classList.contains("armed")).toBe(false);
    expect(root.querySelector(".pc-spell-castcancel")).toBeNull();
  });

  it("a no-ability scroll (non-caster) shows a muted 'set ability' hint, not the removed per-row capture control", () => {
    const root = mountContainer();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 0, { extra: { saving_throw: { ability: "dexterity" } } })], // no ability
      { consumeScroll: vi.fn() },
      { spellcastingClasses: [], derivedSpellSlots: {}, abilitySpellcasting: {} },
    ));
    const row = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    // The broken per-row INT/WIS/CHA capture control is gone (moved to the Spells tab).
    expect(row.querySelector(".pc-scroll-ability")).toBeNull();
    // A muted, non-interactive hint shows in the Hit/DC cell instead of a fabricated DC 0.
    const hint = row.querySelector(".pc-spell-hitdc-hint");
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("set ability");
    expect(row.querySelector(".pc-spell-hitdc-v")).toBeNull();
  });

  it("a scroll WITH a resolved ability shows its DC (no hint)", () => {
    const root = mountContainer();
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 0, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll: vi.fn() },
    ));
    const row = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    expect(row.querySelector(".pc-spell-hitdc-hint")).toBeNull();
    // DEX save DC from derived.abilitySpellcasting.int (15).
    expect(row.querySelector(".pc-spell-hitdc-v")?.textContent).toBe("15");
  });
});
