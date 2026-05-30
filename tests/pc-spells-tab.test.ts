/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SpellsTab } from "../src/modules/pc/components/spells-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type {
  DerivedStats,
  ResolvedCharacter,
  ResolvedSpell,
  SpellcastingClassInfo,
} from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const emptyState = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };

function spell(name: string, level: number, prepared = true): ResolvedSpell {
  return {
    entity: { name, level } as never,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    classSlug: "wizard",
    source: "class",
    prepared,
    alwaysPrepared: false,
  };
}

function resolved(spells: ResolvedSpell[]): ResolvedCharacter {
  return {
    definition: {
      name: "Tordek",
      edition: "2014",
      race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      ability_method: "manual",
      skills: { proficient: [], expertise: [] },
      spells: { known: [], overrides: [], view: "by-level" },
      equipment: [], overrides: {}, state: emptyState,
    } as never,
    race: null,
    classes: [{ entity: { slug: "wizard", name: "Wizard" } as never, level: 5, subclass: null, choices: {} }],
    background: null, feats: [], totalLevel: 5, features: [],
    spells,
    state: emptyState as never,
  };
}

const wizardClass: SpellcastingClassInfo = {
  classSlug: "wizard",
  className: "Wizard",
  ability: "int",
  saveDC: 15,
  attackBonus: 7,
  casterType: "full",
  preparation: "prepared",
};

// New SP4c DerivedStats shape: multiclass-aware `spellcastingClasses`, derived slot
// totals, pact magic, and advisory limits. The old singular `spellcasting`/known-list
// contract this component used before the SP4c rewrite no longer exists.
function derived(over: Partial<DerivedStats> = {}): DerivedStats {
  return {
    spellcastingClasses: [wizardClass],
    derivedSpellSlots: { 1: 4, 2: 2 },
    pactMagic: null,
    spellLimits: [],
    ...over,
  } as DerivedStats;
}

describe("SpellsTab", () => {
  it("shows empty state for non-caster", () => {
    const container = mountContainer();
    new SpellsTab().render(container, {
      resolved: resolved([]),
      derived: derived({ spellcastingClasses: [] }),
      core: {} as never,
      editState: null,
    });
    expect(container.querySelector(".pc-spells-empty-title")?.textContent).toBe("No Spellcasting");
  });

  it("renders the DC/attack header row, by-level slot pips, and the spell list for a caster", () => {
    const container = mountContainer();
    new SpellsTab().render(container, {
      resolved: resolved([spell("Fireball", 3), spell("Mage Armor", 1)]),
      derived: derived(),
      core: {} as never,
      editState: null,
    });

    const dcRow = container.querySelector(".pc-spell-dc-row");
    expect(dcRow?.textContent).toContain("Save DC");
    expect(dcRow?.textContent).toContain("15");
    expect(dcRow?.textContent).toContain("+7");

    // Slot pips exist for the derived slot levels (1st + 2nd).
    expect(container.querySelectorAll(".pc-slot-pips").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".pc-slot-pip").length).toBe(4 + 2);

    // Spell names appear in the by-level tables.
    const names = [...container.querySelectorAll(".pc-action-row-name")].map((n) => n.textContent);
    expect(names).toContain("Fireball");
    expect(names).toContain("Mage Armor");

    // Add-spell action present.
    expect(container.querySelector(".pc-spell-addbtn")).not.toBeNull();
  });

  it("shows the per-level empty message when a caster has no spells at a slot level", () => {
    const container = mountContainer();
    new SpellsTab().render(container, {
      resolved: resolved([]),
      derived: derived(),
      core: {} as never,
      editState: null,
    });
    const subs = [...container.querySelectorAll(".pc-action-row-sub")].map((n) => n.textContent);
    expect(subs.some((t) => /No spells at this level/.test(t ?? ""))).toBe(true);
  });
});
