/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { HeaderSection, buildSubtitle } from "../src/modules/pc/components/header-section";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { SheetComponent, ComponentRenderContext } from "../src/modules/pc/components/component.types";
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
  editState: null,
});

describe("buildSubtitle", () => {
  it("joins race, class+level, and background with bullets (alignment dropped in V7)", () => {
    expect(buildSubtitle(BASE_RESOLVED)).toBe("Hill Folk • Bladesworn 3 • Drifter");
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

class Probe implements SheetComponent {
  constructor(readonly type: string) {}
  render(el: HTMLElement) { el.createDiv({ cls: `probe-${this.type}`, text: this.type }); }
}

function registryWith(types: string[]): ComponentRegistry {
  const r = new ComponentRegistry();
  for (const t of types) r.register(new Probe(t));
  return r;
}

describe("HeaderSection", () => {
  it("renders name, subtitle, avatar placeholder, and hero right cluster (no rest buttons)", () => {
    const container = mountContainer();
    const registry = registryWith(["ac-shield", "hp-widget", "hit-dice-widget"]);
    new HeaderSection(registry).render(container, fakeCtx(BASE_RESOLVED));
    expect(container.querySelector(".pc-name")?.textContent).toBe("Grendal the Wary");
    expect(container.querySelector(".pc-subtitle")?.textContent).toContain("Hill Folk");
    expect(container.querySelector(".pc-avatar")).not.toBeNull();
    expect(container.querySelectorAll(".pc-rest-btn").length).toBe(0);
    expect(container.querySelector(".pc-hero-right .probe-ac-shield")).not.toBeNull();
    expect(container.querySelector(".pc-hero-right .probe-hp-widget")).not.toBeNull();
    expect(container.querySelector(".pc-hero-right .probe-hit-dice-widget")).not.toBeNull();
  });

  it("falls back to pc-empty-line when a right-cluster widget isn't registered", () => {
    const container = mountContainer();
    const registry = registryWith(["hp-widget"]);
    new HeaderSection(registry).render(container, fakeCtx(BASE_RESOLVED));
    const missings = [...container.querySelectorAll(".pc-empty-line")].map((e) => e.textContent);
    expect(missings.some((t) => t?.includes("No renderer for ac-shield"))).toBe(true);
    expect(missings.some((t) => t?.includes("No renderer for hit-dice-widget"))).toBe(true);
    expect(container.querySelector(".pc-hero-right .probe-hp-widget")).not.toBeNull();
  });
});
