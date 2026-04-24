/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SpellsTab } from "../src/modules/pc/components/spells-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const emptyState = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };

function nonCaster(): ResolvedCharacter {
  return {
    definition: { name: "Tordek", edition: "2014", race: null, subrace: null, background: null, class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual", skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] }, equipment: [], overrides: {}, state: emptyState } as never,
    race: null,
    classes: [{ entity: { slug: "fighter", name: "Fighter" } as never, level: 5, subclass: null, choices: {} }],
    background: null, feats: [], totalLevel: 5, features: [], state: emptyState,
  };
}

function caster(): ResolvedCharacter {
  const r = nonCaster();
  (r.classes[0].entity as unknown as { spellcasting: unknown }).spellcasting = { ability: "int", preparation: "prepared", spell_list: "wizard" };
  (r.definition.spells as { known: string[] }).known = ["[[fireball]]", "[[mage-armor]]"];
  (r.state as { spell_slots: Record<number, { used: number; total: number }> }).spell_slots = { 1: { used: 1, total: 4 }, 2: { used: 0, total: 2 } };
  return r;
}

describe("SpellsTab", () => {
  it("shows empty state for non-caster", () => {
    const container = mountContainer();
    new SpellsTab().render(container, { resolved: nonCaster(), derived: { spellcasting: null } as DerivedStats, core: {} as never, editState: null });
    expect(container.querySelector(".pc-spells-empty-title")?.textContent).toBe("No Spellcasting");
  });

  it("renders DC/atk summary, slot grid, and spell list for a caster", () => {
    const container = mountContainer();
    const d: DerivedStats = { spellcasting: { ability: "int", saveDC: 15, attackBonus: 7 } } as DerivedStats;
    new SpellsTab().render(container, { resolved: caster(), derived: d, core: {} as never, editState: null });
    expect(container.querySelector(".pc-spell-summary")?.textContent).toContain("15");
    expect(container.querySelector(".pc-spell-summary")?.textContent).toContain("+7");
    expect(container.querySelectorAll(".pc-slot-cell").length).toBe(2);
    const names = [...container.querySelectorAll(".pc-spell-name")].map((n) => n.textContent);
    expect(names).toEqual(["Fireball", "Mage Armor"]);
  });

  it("uses empty-line message when caster has no known spells", () => {
    const container = mountContainer();
    const r = caster();
    (r.definition.spells as { known: string[] }).known = [];
    const d: DerivedStats = { spellcasting: { ability: "int", saveDC: 15, attackBonus: 7 } } as DerivedStats;
    new SpellsTab().render(container, { resolved: r, derived: d, core: {} as never, editState: null });
    expect(container.querySelector(".pc-empty-line")?.textContent).toMatch(/No spells/);
  });
});
