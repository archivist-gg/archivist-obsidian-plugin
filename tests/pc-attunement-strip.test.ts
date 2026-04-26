/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AttunementStrip } from "../src/modules/pc/components/inventory/attunement-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { Character, ResolvedCharacter, DerivedStats, EquippedSlots } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const baseChar = (): Character => ({
  name: "T", edition: "2014", race: null, subrace: null, background: null,
  class: [{ name: "fighter", level: 1, subclass: null, choices: {} }],
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ability_method: "manual",
  skills: { proficient: [], expertise: [] },
  spells: { known: [], overrides: [] },
  equipment: [],
  overrides: {},
  state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: 0, exhaustion: 0 },
});

function ctx(c: Character, attunementUsed = 0, attunementLimit = 3): ComponentRenderContext {
  return {
    resolved: { definition: c, race: null, classes: [], background: null, feats: [], totalLevel: 1, features: [], state: c.state } as ResolvedCharacter,
    derived: { ac: 0, acBreakdown: [], attacks: [], equippedSlots: {} as EquippedSlots, carriedWeight: 0, attunementUsed, attunementLimit } as DerivedStats,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("AttunementStrip", () => {
  it("renders the label and X / Y count", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctx(baseChar(), 2, 3));
    expect(root.querySelector(".pc-attune-label")?.textContent).toMatch(/attuned/i);
    expect(root.querySelector(".pc-attune-count")?.textContent).toMatch(/2\s*\/\s*3/);
  });

  it("renders 3 medallions when limit is 3 and 0 attuned", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctx(baseChar(), 0, 3));
    expect(root.querySelectorAll(".pc-medallion")).toHaveLength(3);
    expect([...root.querySelectorAll(".pc-medallion")].every((m) => m.classList.contains("empty"))).toBe(true);
  });

  it("filled slots come first, then empty slots", () => {
    const c = baseChar();
    c.equipment = [
      { item: "[[ring-of-evasion]]", attuned: true },
      { item: "[[longsword]]" },
      { item: "[[bracers-of-defense]]", attuned: true },
    ];
    const root = mountContainer();
    new AttunementStrip().render(root, ctx(c, 2, 3));
    const meds = [...root.querySelectorAll(".pc-medallion")];
    expect(meds).toHaveLength(3);
    expect(meds[0].classList.contains("empty")).toBe(false);
    expect(meds[1].classList.contains("empty")).toBe(false);
    expect(meds[2].classList.contains("empty")).toBe(true);
  });

  it("respects overrides.attunement_limit", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctx(baseChar(), 0, 5));
    expect(root.querySelectorAll(".pc-medallion")).toHaveLength(5);
  });
});
