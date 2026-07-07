/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SpellsTab } from "../packages/obsidian/src/modules/pc/components/spells-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { DerivedStats, ResolvedCharacter, ResolvedSpell, SpellcastingClassInfo } from "@archivist/dnd5e/pc/pc.types";

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
