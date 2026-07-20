/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SpellsTab } from "../packages/obsidian/src/modules/pc/components/spells-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { DerivedStats, ResolvedCharacter, ResolvedSpell, SpellcastingClassInfo } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const emptyState = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };
function spell(name: string, level: number, prepared = true): ResolvedSpell {
  return { entity: { name, level } as never, slug: name.toLowerCase().replace(/\s+/g, "-"), classSlug: "wizard", source: "class", prepared, alwaysPrepared: false };
}
function resolved(spells: ResolvedSpell[]): ResolvedCharacter {
  return {
    definition: { name: "Tordek", edition: "2014", race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, ability_method: "manual",
      skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
      equipment: [], overrides: {}, state: emptyState } as never,
    race: null, classes: [{ entity: { slug: "wizard", name: "Wizard" } as never, level: 5, subclass: null, choices: {} }],
    background: null, feats: [], totalLevel: 5, features: [], spells, state: emptyState as never,
  };
}
const wizardClass: SpellcastingClassInfo = { classSlug: "wizard", className: "Wizard", ability: "int", saveDC: 15, attackBonus: 7, casterType: "full", preparation: "prepared" };
function derived(over: Partial<DerivedStats> = {}): DerivedStats {
  return { spellcastingClasses: [wizardClass], derivedSpellSlots: { 1: 4, 2: 2 }, pactMagic: null, spellLimits: [], ...over } as DerivedStats;
}

describe("SpellsTab", () => {
  it("shows empty state for non-caster", () => {
    const c = mountContainer();
    new SpellsTab().render(c, { resolved: resolved([]), derived: derived({ spellcastingClasses: [] }), services: {} as never, app: {} as never, editState: null });
    expect(c.querySelector(".pc-spells-empty-title")?.textContent).toBe("No Spellcasting");
  });

  it("surfaces feat-granted spells on a non-caster (Magic Initiate on a Fighter), not the empty state", () => {
    // A non-caster with NO spellcasting class but a feat-granted spell (Magic
    // Initiate) must still show the Spells section: the feat cantrip renders with
    // its OWN-ability DC (from derived.abilitySpellcasting), never the "No
    // Spellcasting" empty state. Task 3f surfaced this gap in the 3e surfacing.
    const c = mountContainer();
    const featCantrip: ResolvedSpell = {
      entity: { name: "Sacred Flame", level: 0, saving_throw: { ability: "dexterity" } } as never,
      slug: "srd-2024_sacred-flame", classSlug: null, source: "feat", prepared: true, alwaysPrepared: true, ability: "wis",
    };
    new SpellsTab().render(c, {
      resolved: resolved([featCantrip]),
      derived: derived({ spellcastingClasses: [], derivedSpellSlots: {}, abilitySpellcasting: { wis: { saveDC: 12, attackBonus: 4 } } as never }),
      services: {} as never, app: {} as never, editState: null,
    });
    expect(c.querySelector(".pc-spells-empty-title")).toBeNull();
    const names = [...c.querySelectorAll(".pc-spell-name")].map((e) => e.textContent);
    expect(names).toContain("Sacred Flame");
    // The feat cantrip carries the always-prepared marker and the own-ability DC.
    expect(c.querySelector(".pc-spell-always")).not.toBeNull();
    expect(c.querySelector(".pc-spell-cast-row")?.textContent).toContain("12");
  });

  it("surfaces an item (scroll) spell on a non-caster, not the empty state (P4 T6)", () => {
    // A non-caster holding a Spell Scroll must still get the Spells section: the
    // scroll surfaces under Scrolls & Consumables, never the "No Spellcasting"
    // empty state.
    const c = mountContainer();
    const scrollSpell: ResolvedSpell = {
      entity: { name: "Fireball", level: 3, saving_throw: { ability: "dexterity" } } as never,
      slug: "fireball", classSlug: null, source: "item", prepared: true, alwaysPrepared: true, ability: "int", entryIndex: 0,
    };
    new SpellsTab().render(c, {
      resolved: resolved([scrollSpell]),
      derived: derived({ spellcastingClasses: [], derivedSpellSlots: {}, abilitySpellcasting: { int: { saveDC: 15, attackBonus: 7 } } as never }),
      services: {} as never, app: {} as never, editState: null,
    });
    expect(c.querySelector(".pc-spells-empty-title")).toBeNull();
    const names = [...c.querySelectorAll(".pc-spell-name")].map((e) => e.textContent);
    expect(names).toContain("Fireball");
    // The scroll surfaces with the shared CAST button (the retired bespoke
    // .pc-spell-scroll lozenge is gone); a non-caster owns no slot boxes, so this
    // CAST button is the scroll's consume control.
    expect(c.querySelector(".pc-spell-castbtn")).not.toBeNull();
  });

  it("renders DC header, the Cast/Prepare toggle, and Cast view by default", () => {
    const c = mountContainer();
    new SpellsTab().render(c, { resolved: resolved([spell("Magic Missile", 1)]), derived: derived(), services: {} as never, app: {} as never, editState: null });
    expect(c.querySelector(".pc-spell-dc-row")?.textContent).toContain("15");
    const segs = [...c.querySelectorAll(".pc-mode-seg")].map((s) => s.textContent);
    expect(segs).toEqual(["Cast", "Prepare"]);
    expect(c.querySelector(".pc-mode-seg.active")?.textContent).toBe("Cast");
    expect(c.querySelectorAll(".archivist-toggle-box").length).toBe(4 + 2); // cast-view slot boxes
  });

  it("clicking Prepare switches to the prepare view (counters visible)", () => {
    const c = mountContainer();
    const tab = new SpellsTab();
    const ctx = { resolved: resolved([spell("Magic Missile", 1)]), derived: derived({ spellLimits: [{ classSlug: "wizard", kind: "prepared", cantripsKnown: 5, preparedOrKnown: 8 } as never] }), services: {} as never, app: {} as never, editState: null };
    tab.render(c, ctx);
    (c.querySelector(".pc-mode-seg:nth-child(2)") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(c.querySelector(".pc-spell-counts")).not.toBeNull();
  });

  it("labels the second mode Manage for a known caster", () => {
    const c = mountContainer();
    const known: SpellcastingClassInfo = { ...wizardClass, classSlug: "sorcerer", className: "Sorcerer", ability: "cha", preparation: "known" };
    new SpellsTab().render(c, { resolved: resolved([]), derived: derived({ spellcastingClasses: [known] }), services: {} as never, app: {} as never, editState: null });
    const segs = [...c.querySelectorAll(".pc-mode-seg")].map((s) => s.textContent);
    expect(segs).toEqual(["Cast", "Manage"]);
  });

  it("shows a situational popover on hover over the DC row when the spell slice is non-empty", () => {
    const c = mountContainer();
    new SpellsTab().render(c, {
      resolved: resolved([spell("Magic Missile", 1)]),
      derived: derived({
        spellcastingInformational: [
          { field: "spell_attack", source: "Rod of the Pact Keeper", value: 1, conditions: [{ kind: "raw", text: "while attuned" }] },
        ] as never,
      }),
      services: {} as never, app: {} as never, editState: null,
    });
    const dcRow = c.querySelector<HTMLElement>(".pc-spell-dc-row")!;
    dcRow.dispatchEvent(new Event("mouseenter"));
    const tip = dcRow.querySelector(".pc-stat-tooltip");
    expect(tip).not.toBeNull();
    expect(tip?.querySelector(".pc-stat-tooltip-title")?.textContent).toBe("Spell — situational");
    const rows = tip!.querySelectorAll(".pc-situational-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Rod of the Pact Keeper");
  });

  it("attaches NO popover when the spell slice is absent (situational-free character)", () => {
    const c = mountContainer();
    new SpellsTab().render(c, { resolved: resolved([spell("Magic Missile", 1)]), derived: derived(), services: {} as never, app: {} as never, editState: null });
    const dcRow = c.querySelector<HTMLElement>(".pc-spell-dc-row")!;
    dcRow.dispatchEvent(new Event("mouseenter"));
    expect(dcRow.querySelector(".pc-stat-tooltip")).toBeNull();
  });

  it("attaches NO popover when spellcastingInformational is explicitly empty ([])", () => {
    const c = mountContainer();
    new SpellsTab().render(c, {
      resolved: resolved([spell("Magic Missile", 1)]),
      derived: derived({ spellcastingInformational: [] as never }),
      services: {} as never, app: {} as never, editState: null,
    });
    const dcRow = c.querySelector<HTMLElement>(".pc-spell-dc-row")!;
    dcRow.dispatchEvent(new Event("mouseenter"));
    expect(dcRow.querySelector(".pc-stat-tooltip")).toBeNull();
  });

  it("shows the top-of-Cast 'Cast scrolls using' control for a non-caster holding a scroll and writes overrides.spellcasting_ability on pick (P4)", () => {
    const c = mountContainer();
    const scrollSpell: ResolvedSpell = {
      entity: { name: "Fireball", level: 3 } as never,
      slug: "fireball", classSlug: null, source: "item", prepared: true, alwaysPrepared: true, entryIndex: 0,
    };
    const setSpellcastingAbility = vi.fn();
    new SpellsTab().render(c, {
      resolved: resolved([scrollSpell]),
      derived: derived({ spellcastingClasses: [], derivedSpellSlots: {} }),
      services: {} as never, app: {} as never, editState: { setSpellcastingAbility } as never,
    });
    const ctrl = c.querySelector(".pc-spellability-set");
    expect(ctrl).not.toBeNull();
    const btns = [...ctrl!.querySelectorAll(".pc-mode-seg")].map((b) => b.textContent);
    expect(btns).toEqual(["INT", "WIS", "CHA"]);
    // The 2nd segmented button (WIS) writes the character-level override.
    (ctrl!.querySelector(".pc-mode-seg:nth-child(2)") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(setSpellcastingAbility).toHaveBeenCalledWith("wis");
  });

  it("reflects the current overrides.spellcasting_ability as the active segment", () => {
    const c = mountContainer();
    const scrollSpell: ResolvedSpell = {
      entity: { name: "Fireball", level: 3 } as never,
      slug: "fireball", classSlug: null, source: "item", prepared: true, alwaysPrepared: true, entryIndex: 0,
    };
    const r = resolved([scrollSpell]);
    (r.definition.overrides as { spellcasting_ability?: string }).spellcasting_ability = "wis";
    new SpellsTab().render(c, {
      resolved: r, derived: derived({ spellcastingClasses: [], derivedSpellSlots: {} }),
      services: {} as never, app: {} as never, editState: { setSpellcastingAbility: vi.fn() } as never,
    });
    const active = c.querySelector(".pc-spellability-set .pc-mode-seg.active");
    expect(active?.textContent).toBe("WIS");
  });

  it("hides the 'Cast scrolls using' control when the character has its own spellcasting ability", () => {
    const c = mountContainer();
    const scrollSpell: ResolvedSpell = {
      entity: { name: "Fireball", level: 3 } as never,
      slug: "fireball", classSlug: null, source: "item", prepared: true, alwaysPrepared: true, entryIndex: 0, ability: "int",
    };
    new SpellsTab().render(c, {
      resolved: resolved([scrollSpell]), derived: derived(), // wizard caster present
      services: {} as never, app: {} as never, editState: null,
    });
    expect(c.querySelector(".pc-spellability-set")).toBeNull();
  });

  it("shows a concentration tile (brain) in the active-effects rail when concentrating", () => {
    const c = mountContainer();
    const r = resolved([spell("Hold Person", 2)]);
    (r.state as never as { concentration: string }).concentration = "hold-person";
    new SpellsTab().render(c, { resolved: r, derived: derived(), services: {} as never, app: {} as never, editState: null });
    const tile = c.querySelector(".pc-ae-tile");
    expect(tile).not.toBeNull();
    expect(tile?.textContent).toContain("Hold Person");
    expect(c.querySelector(".pc-ae-label")?.textContent).toBe("Concentration");
    expect(c.querySelector(".pc-conc-banner")).toBeNull();
  });
});
