/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderCastView } from "../packages/obsidian/src/modules/pc/components/spells/cast-view";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedSpell, DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import { toggleSpellBlock } from "../packages/obsidian/src/modules/pc/components/spells/spell-block-expand";
import { confirm } from "../packages/obsidian/src/shared/modals/ConfirmModal";

// Stub the block renderer so the expand wiring can be asserted without the async spell-block render.
vi.mock("../packages/obsidian/src/modules/pc/components/spells/spell-block-expand", () => ({ toggleSpellBlock: vi.fn() }));
// Stub the confirm popup so the scroll cast flow can be asserted without opening a real modal.
vi.mock("../packages/obsidian/src/shared/modals/ConfirmModal", () => ({ confirm: vi.fn() }));
const confirmMock = vi.mocked(confirm);

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

// R4-G7 T8 RIDER-15 (F-NODICE (a)): a cantrip row prints its damage at the character's TOTAL level, in the same
// `.pc-spell-eff` chip an upcast row prints. The Fire Bolt is the PHB 2024 shape (5 / 11 / 17 only).
describe("renderCastView · a cantrip's damage at the character's level (R4-G7 T8 RIDER-15)", () => {
  const fireBolt = () => sp("Fire Bolt", 0, {
    damage: { types: ["fire"] } as never,
    casting_options: [
      { type: "player_level_5", damage_roll: "2d10" },
      { type: "player_level_11", damage_roll: "3d10" },
      { type: "player_level_17", damage_roll: "4d10" },
    ] as never,
  });
  const atLevel = (totalLevel: number): HTMLElement => {
    const root = mountContainer();
    const ctx = ctxFor([fireBolt()]);
    (ctx.derived as unknown as { totalLevel: number }).totalLevel = totalLevel;
    renderCastView(root, ctx);
    return sectionTableAfter(root, "Cantrips").querySelector(".pc-spell-cast-row") as HTMLElement;
  };
  it("a level-20 caster's Fire Bolt row carries the 4d10 chip with the damage icon, the type word under it", () => {
    const row = atLevel(20);
    expect(row.querySelector(".pc-spell-eff")?.textContent).toBe("4d10");
    expect(row.querySelector(".pc-spell-eff .pc-spell-dtype-icon")).not.toBeNull();
    expect(row.querySelector(".pc-spell-dtype")?.textContent).toBe("fire");
  });
  it("a level-4 caster's Fire Bolt row has no chip (the base roll is not in the data), the type word keeps its icon", () => {
    const row = atLevel(4);
    expect(row.querySelector(".pc-spell-eff")).toBeNull();
    expect(row.querySelector(".pc-spell-dtype .pc-spell-dtype-icon")).not.toBeNull();
  });
});

// R4-G7 T8 RIDER-16 (F-CHIP (a)): where a scaled value prints is decided by the FIELD it came from, never by a spell
// list: `damage_roll` -> the chip with the damage icon; `target_count` -> a plain chip; `duration` -> no chip, it
// REPLACES the row's duration text at that slot; `desc` -> a muted caption line in the effect cell, never the chip.
describe("renderCastView · the scaled value prints where its FIELD says (R4-G7 T8 RIDER-16)", () => {
  const upcastRow = (spell: ResolvedSpell, slots: Record<number, number>, name: string): HTMLElement => {
    const root = mountContainer();
    const ctx = ctxFor([spell]);
    (ctx.derived as unknown as { derivedSpellSlots: Record<number, number> }).derivedSpellSlots = slots;
    renderCastView(root, ctx);
    return Array.from(root.querySelectorAll<HTMLElement>(".pc-spell-cast-row"))
      .find((r) => r.querySelector(".pc-spell-name")?.textContent === name && r.querySelector(".pc-spell-up"))!;
  };
  it("a DURATION value (PHB 2014 Bestow Curse at 4th) replaces the duration text and is never a chip", () => {
    const bestow = sp("Bestow Curse", 3, {
      duration: "1 minute", concentration: true, damage: { types: ["necrotic"] } as never,
      casting_options: [{ type: "slot_level_4", duration: "10 minutes" }] as never,
    });
    const row = upcastRow(bestow, { 3: 3, 4: 2 }, "Bestow Curse");
    expect(row.querySelector(".pc-spell-dur")?.textContent).toBe("Conc · 10 minutes");
    expect(row.querySelector(".pc-spell-eff")).toBeNull();
    // with no damage chip carrying it, the type word keeps its icon
    expect(row.querySelector(".pc-spell-dtype .pc-spell-dtype-icon")).not.toBeNull();
  });
  it("a DESC value (PHB 2024 False Life at 2nd) prints as a caption line in the effect cell, never the chip", () => {
    const falseLife = sp("False Life", 1, {
      duration: "1 hour", casting_options: [{ type: "slot_level_2", desc: "You gain 2d4 + 9 temporary hit points." }] as never,
    });
    const row = upcastRow(falseLife, { 1: 4, 2: 3 }, "False Life");
    expect(row.querySelector(".pc-spell-effcell .pc-spell-eff-note")?.textContent).toBe("You gain 2d4 + 9 temporary hit points.");
    expect(row.querySelector(".pc-spell-eff")).toBeNull();
    expect(row.querySelector(".pc-spell-dur")?.textContent).toBe("1 hour");
  });
  it("a TARGET_COUNT value (Magic Missile at 2nd) is a plain chip: no damage icon inside it, the type word keeps its icon", () => {
    const mm = sp("Magic Missile", 1, {
      damage: { types: ["force"] } as never, casting_options: [{ type: "slot_level_2", target_count: 4 }] as never,
    });
    const row = upcastRow(mm, { 1: 4, 2: 3 }, "Magic Missile");
    expect(row.querySelector(".pc-spell-eff .pc-spell-dtype-icon")).toBeNull();
    expect(row.querySelector(".pc-spell-eff")?.textContent).toBe("4 targets");
    expect(row.querySelector(".pc-spell-dtype .pc-spell-dtype-icon")).not.toBeNull();
  });
  it("a DAMAGE_ROLL value keeps today's chip with the damage icon and a bare type word (characterisation)", () => {
    const fireball = sp("Fireball", 3, {
      duration: "instantaneous", damage: { types: ["fire"] } as never, casting_options: [{ type: "slot_level_4", damage_roll: "9d6" }] as never,
    });
    const row = upcastRow(fireball, { 3: 3, 4: 2 }, "Fireball");
    expect(row.querySelector(".pc-spell-eff")?.textContent).toBe("9d6");
    expect(row.querySelector(".pc-spell-eff .pc-spell-dtype-icon")).not.toBeNull();
    expect(row.querySelector(".pc-spell-dtype .pc-spell-dtype-icon")).toBeNull();
    expect(row.querySelector(".pc-spell-eff-note")).toBeNull();
    expect(row.querySelector(".pc-spell-dur")?.textContent).toBe("instantaneous");
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
// Drain the microtask queue so the async confirm().then() consume path settles.
function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("renderCastView · scrolls & consumables", () => {
  beforeEach(() => confirmMock.mockReset());

  it("scroll row reuses the real CAST button (not the retired lozenge) and shows no Always prepared marker", () => {
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
    // A consumable scroll must NOT show the "Always prepared" marker (alwaysPrepared is a
    // resolver castability flag, not an "always ready" claim here).
    expect(scrollRow.querySelector(".pc-spell-always")).toBeNull();

    // The owned 3rd-level section shows ONLY the class copy, never a second (item) Fireball row.
    const l3Body = sectionTableAfter(root, "3rd Level");
    const l3Fireballs = [...l3Body.querySelectorAll(".pc-spell-name")].filter((n) => n.textContent === "Fireball");
    expect(l3Fireballs.length).toBe(1);
  });

  it("still renders the Always prepared marker for a non-scroll always-prepared spell (guard: only scrolls are suppressed)", () => {
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

  it("clicking CAST opens a consume-confirm popup naming the spell (no inline arm affordance, nothing consumed yet)", async () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    confirmMock.mockResolvedValue(false); // pretend the user hasn't answered / cancels
    const ctx = ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll, expendSlot: vi.fn(), castSpell: vi.fn(), restoreSlot: vi.fn() },
    );
    renderCastView(root, ctx);
    const scrollRow = sectionTableAfter(root, "Scrolls & Consumables").querySelector(".pc-spell-cast-row") as HTMLElement;
    const btn = scrollCastBtn(root);
    // The control stays a plain CAST button — the retired inline arm/cancel is gone.
    expect(btn.textContent).toBe("CAST");
    click(btn);
    // The confirm popup opens with the sheet app, a message naming the spell that
    // states it consumes + removes the scroll, and a "Consume" confirm label.
    expect(confirmMock).toHaveBeenCalledTimes(1);
    const [app, message, confirmLabel] = confirmMock.mock.calls[0];
    expect(app).toBe(ctx.app);
    expect(message).toContain("Fireball");
    expect(message.toLowerCase()).toContain("consume");
    expect(message.toLowerCase()).toContain("remove");
    expect(confirmLabel).toBe("Consume");
    // No inline arm affordance is created and the button label never flips.
    expect(btn.textContent).toBe("CAST");
    expect(btn.classList.contains("armed")).toBe(false);
    expect(scrollRow.classList.contains("pc-row-arming")).toBe(false);
    expect(root.querySelector(".pc-spell-castcancel")).toBeNull();
    // Nothing is consumed until the popup resolves true.
    await flush();
    expect(consumeScroll).not.toHaveBeenCalled();
  });

  it("confirming the popup consumes the scroll by entryIndex and never expends a slot", async () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    const expendSlot = vi.fn();
    confirmMock.mockResolvedValue(true);
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll, expendSlot, castSpell: vi.fn(), restoreSlot: vi.fn() },
    ));
    click(scrollCastBtn(root));
    await flush();
    expect(consumeScroll).toHaveBeenCalledWith(2);
    expect(expendSlot).not.toHaveBeenCalled();
  });

  it("cancelling the popup is a no-op (nothing consumed)", async () => {
    const root = mountContainer();
    const consumeScroll = vi.fn();
    confirmMock.mockResolvedValue(false);
    renderCastView(root, ctxForScroll(
      [itemSp("Fireball", 3, 2, { ability: "int", extra: { saving_throw: { ability: "dexterity" } } })],
      { consumeScroll },
    ));
    click(scrollCastBtn(root));
    await flush();
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(consumeScroll).not.toHaveBeenCalled();
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

describe("renderCastView — D1 spell-block persistence", () => {
  it("re-creates a spell's open reference block across a re-render with the same bag", () => {
    const bag = new Map<string, unknown>();
    const c1 = ctxFor([sp("Hold Person", 2)]);
    const root1 = mountContainer();
    renderCastView(root1, { ...c1, builderUiState: bag });
    const row1 = root1.querySelector(".pc-spell-cast-row") as HTMLElement;
    (row1.querySelector(".pc-spell-namecell") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root1.querySelector(".pc-spell-expand-row")).not.toBeNull();

    const root2 = mountContainer();
    renderCastView(root2, { ...ctxFor([sp("Hold Person", 2)]), builderUiState: bag });
    expect(root2.querySelector(".pc-spell-expand-row")).not.toBeNull();
    expect((root2.querySelector(".pc-spell-cast-row") as HTMLElement).classList.contains("pc-row-open")).toBe(true);
  });

  it("upcast uniqueness: opening the base-level row re-expands ONLY that row, not its upcast copy", () => {
    const bag = new Map<string, unknown>();
    const mm = () => sp("Magic Missile", 1, { casting_options: [{ type: "slot_level_2", target_count: 4 }] as never });
    const root1 = mountContainer();
    renderCastView(root1, { ...ctxFor([mm()]), builderUiState: bag });
    // The base row is the one WITHOUT the upcast badge.
    const rows1 = [...root1.querySelectorAll<HTMLElement>(".pc-spell-cast-row")];
    const baseRow = rows1.find((r) => !r.querySelector(".pc-spell-up"))!;
    (baseRow.querySelector(".pc-spell-namecell") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const root2 = mountContainer();
    renderCastView(root2, { ...ctxFor([mm()]), builderUiState: bag });
    const rows2 = [...root2.querySelectorAll<HTMLElement>(".pc-spell-cast-row")];
    const base2 = rows2.find((r) => !r.querySelector(".pc-spell-up"))!;
    const upcast2 = rows2.find((r) => r.querySelector(".pc-spell-up"))!;
    expect(base2.classList.contains("pc-row-open")).toBe(true);
    expect(upcast2.classList.contains("pc-row-open")).toBe(false);
    expect(root2.querySelectorAll(".pc-spell-expand-row").length).toBe(1);
  });
});

// Fix round 1 (F-6): the three legs below are about the CANTRIPS SECTION, not D1's expand-block persistence; they
// were nested in that describe only because they were appended to the file. Their bodies are byte-identical to what
// the D1 block carried, so m14's kill row is still the second leg's first `expect`.
describe("renderCastView · cantrips section (R4-G6b §9)", () => {
  it("a caster who can know cantrips but has none renders an empty Cantrips section (R4-G6b §9)", () => {
    const root = mountContainer();
    const ctx = ctxFor([sp("Cure Wounds", 1)]);
    (ctx.derived as { spellLimits: unknown[] }).spellLimits = [{ classSlug: "bard", kind: "known", cantripsKnown: 3, preparedOrKnown: 8 }];
    renderCastView(root, ctx);
    // The DOM is root > [.pc-spell-sec, .pc-spell-cast-table, .pc-spell-sec, ...]: the table is a SIBLING of the head
    // (`tableFor(root)`), and the empty row lives inside the table (Gate 2 B-6). Only the slots are children of the head.
    const heads = Array.from(root.querySelectorAll(".pc-spell-sec-label")).map((e) => e.textContent);
    expect(heads[0]).toBe("Cantrips");
    expect(root.querySelector(".pc-spell-cast-table")).not.toBeNull();
    expect(root.querySelector(".pc-spell-empty-row")?.textContent).toBe("None prepared.");
    expect(root.querySelector(".pc-spell-sec")!.querySelector(".pc-spell-slots")).toBeNull();
  });
  // Fix round 1 (F-6 c): the title said "a non-caster and a derived without spellLimits", but the fixture is
  // `ctxFor([])` — a full Wizard (`spellcastingClasses: [wizard]`, `derivedSpellSlots: { 1: 4, 2: 3 }`) with
  // `spellLimits` deleted. Only the second half was ever asserted; the title now claims only that.
  it("a derived without spellLimits renders without throwing and no Cantrips section", () => {
    const root = mountContainer(); const ctx = ctxFor([]); delete (ctx.derived as { spellLimits?: unknown }).spellLimits;
    expect(() => renderCastView(root, ctx)).not.toThrow();
    expect(root.querySelector(".pc-spell-sec-label")?.textContent).not.toBe("Cantrips");
  });
  it("a cantripsKnown 0 limit with no cantrips renders no Cantrips section, and cantrips present render rows with no empty row (R4-G6b §14 row 24)", () => {
    const bare = mountContainer();
    const bareCtx = ctxFor([sp("Cure Wounds", 1)]);
    // Fix round 1 (F-6 b): `ctxFor`'s default `spellLimits: []` misses the boundary entirely (nothing to iterate).
    // A shipped-data shape that DOES iterate is a class that knows no cantrips (Paladin, and the 2014 Ranger):
    // `cantripsKnown: 0` must not open the section, which is what `(l.cantripsKnown ?? 0) > 0` says.
    (bareCtx.derived as { spellLimits: unknown[] }).spellLimits = [{ classSlug: "paladin", kind: "prepared", cantripsKnown: 0, preparedOrKnown: 4 }];
    renderCastView(bare, bareCtx);
    expect(Array.from(bare.querySelectorAll(".pc-spell-sec-label")).map((e) => e.textContent)).not.toContain("Cantrips");

    const root = mountContainer();
    const ctx = ctxFor([sp("Fire Bolt", 0)]);
    // A cantrip-only caster owns no leveled slots, so the Cantrips table is the only table rendered.
    (ctx.derived as never as { derivedSpellSlots: Record<number, number> }).derivedSpellSlots = {};
    (ctx.derived as { spellLimits: unknown[] }).spellLimits = [{ classSlug: "wizard", kind: "known", cantripsKnown: 3, preparedOrKnown: null }];
    renderCastView(root, ctx);
    expect(root.querySelectorAll(".pc-spell-cast-row").length).toBe(1);
    expect(root.querySelector(".pc-spell-empty-row")).toBeNull();
  });
});

// R4-G7 T8 RIDER-17 (F-ALWAYS (a)): the always-prepared marker reads as words, from ONE label both spell views share.
describe("renderCastView · the always-prepared marker (R4-G7 T8 RIDER-17)", () => {
  it("an always-prepared row's marker reads `Always prepared`, never the bare lowercase `always`", () => {
    const root = mountContainer();
    const domain: ResolvedSpell = {
      entity: { name: "Bless", level: 1 } as never, slug: "bless",
      classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: true,
    };
    renderCastView(root, ctxForScroll([domain]));
    expect(sectionTableAfter(root, "1st Level").querySelector(".pc-spell-always")?.textContent).toMatch(/^Always prepared$/);
  });
});

// R4-G7 T8 RIDER-19 (F-PACT), the plugin half: a CHARACTERISATION pin, green by construction. The Cast view already routes
// a pact class's levelled spells to the Pact Magic block and keeps them out of the owned-slot blocks (base AND upcast);
// the live "No spells." under PACT MAGIC was the engine attributing every un-classed spell to the first caster (dnd5e
// `pc.resolver.ts`, fixed there). This pins the routing a correctly attributed Paladin / Warlock sheet relies on.
describe("renderCastView · a Paladin / Warlock multiclass routes the Warlock's spells to Pact Magic (R4-G7 T8 RIDER-19)", () => {
  it("the Warlock's spell lists under PACT MAGIC once, the Paladin's under 1st Level, and the pact block claims no emptiness", () => {
    const root = mountContainer();
    const pal = (name: string): ResolvedSpell => ({ ...sp(name, 1), classSlug: "players-handbook-2014_class_paladin" });
    const war = (name: string, extra: Partial<ResolvedSpell["entity"]> = {}): ResolvedSpell => ({ ...sp(name, 1, extra), classSlug: "players-handbook-2014_class_warlock" });
    const ctx = ctxFor([pal("Bless"), war("Armor of Agathys", { casting_options: [{ type: "slot_level_2", desc: "You gain 10 temporary hit points." }] as never })]);
    (ctx.derived as unknown as Record<string, unknown>).spellcastingClasses = [
      { classSlug: "players-handbook-2014_class_paladin", className: "Paladin", ability: "cha", saveDC: 14, attackBonus: 6, casterType: "half", preparation: "prepared" },
      { classSlug: "players-handbook-2014_class_warlock", className: "Warlock", ability: "cha", saveDC: 14, attackBonus: 6, casterType: "pact", preparation: "known" },
    ];
    (ctx.derived as unknown as Record<string, unknown>).derivedSpellSlots = { 1: 4, 2: 2 };
    (ctx.derived as unknown as Record<string, unknown>).pactMagic = { level: 3, total: 2 };
    renderCastView(root, ctx);
    const names = (label: string) => Array.from(sectionTableAfter(root, label).querySelectorAll(".pc-spell-name")).map((n) => n.textContent);
    expect(names("Pact Magic (L3)")).toEqual(["Armor of Agathys"]);
    expect(names("1st Level")).toEqual(["Bless"]);
    expect(names("2nd Level")).not.toContain("Armor of Agathys");
    expect(sectionTableAfter(root, "Pact Magic (L3)").querySelector(".pc-spell-empty-row")).toBeNull();
  });
});
