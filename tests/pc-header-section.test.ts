/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { HeaderSection, buildSubtitle } from "../src/modules/pc/components/header-section";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedCharacter, DerivedStats } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const BASE_RESOLVED: ResolvedCharacter = {
  definition: {
    name: "Grendal the Wary",
    edition: "2014",
    alignment: "Lawful Good",
    race: "[[hill-folk]]",
    subrace: null,
    background: "[[drifter]]",
    class: [{ name: "[[bladesworn]]", level: 3, subclass: null, choices: {} }],
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ability_method: "manual",
    skills: { proficient: [], expertise: [] },
    spells: { known: [], overrides: [] },
    equipment: [],
    overrides: {},
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
  },
  race: { slug: "hill-folk", name: "Hill Folk" } as never,
  classes: [{ entity: { slug: "bladesworn", name: "Bladesworn" } as never, level: 3, subclass: null, choices: {} }],
  background: { slug: "drifter", name: "Drifter" } as never,
  feats: [],
  totalLevel: 3,
  features: [],
  state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
};

const fakeCtx = (resolved: ResolvedCharacter): ComponentRenderContext => ({
  resolved,
  derived: {} as DerivedStats,
  core: {} as never,
});

describe("buildSubtitle", () => {
  it("joins race, class+level, background, alignment with bullets", () => {
    expect(buildSubtitle(BASE_RESOLVED)).toBe("Hill Folk • Bladesworn 3 • Drifter • Lawful Good");
  });
  it("includes subclass in parentheses when present", () => {
    const r = { ...BASE_RESOLVED, classes: [{ ...BASE_RESOLVED.classes[0], subclass: { slug: "path-of-shadow", name: "Path of Shadow" } as never }] };
    expect(buildSubtitle(r)).toContain("Bladesworn (Path of Shadow) 3");
  });
  it("handles missing race gracefully", () => {
    const r = { ...BASE_RESOLVED, race: null, definition: { ...BASE_RESOLVED.definition, race: null } };
    const s = buildSubtitle(r);
    expect(s).toContain("Bladesworn 3");
    expect(s).not.toMatch(/^•/);
  });
});

describe("HeaderSection", () => {
  it("renders name, subtitle, avatar placeholder, and two disabled rest buttons", () => {
    const container = mountContainer();
    new HeaderSection().render(container, fakeCtx(BASE_RESOLVED));
    expect(container.querySelector(".pc-name")?.textContent).toBe("Grendal the Wary");
    expect(container.querySelector(".pc-subtitle")?.textContent).toContain("Hill Folk");
    expect(container.querySelector(".pc-avatar")).not.toBeNull();
    const btns = container.querySelectorAll<HTMLButtonElement>(".pc-rest-btn");
    expect(btns.length).toBe(2);
    btns.forEach((b) => expect(b.hasAttribute("disabled")).toBe(true));
  });
});
