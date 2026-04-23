/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { CombatStatsRow } from "../src/modules/pc/components/combat-stats-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ctx = (d: Partial<DerivedStats> = {}, r: Partial<ResolvedCharacter> = {}): ComponentRenderContext => ({
  resolved: {
    state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
    ...r,
  } as ResolvedCharacter,
  derived: {
    totalLevel: 5, proficiencyBonus: 3, scores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
    mods: { str: 0, dex: 2, con: 1, int: 0, wis: 0, cha: 0 },
    saves: {} as never, skills: {} as never,
    passives: { perception: 10, investigation: 10, insight: 10 },
    hp: { max: 44, current: 30, temp: 5 }, ac: 16, speed: 30, initiative: 2,
    spellcasting: null, warnings: [], ...d,
  },
  core: {} as never,
});

describe("CombatStatsRow", () => {
  it("renders six stat cards", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx());
    const cards = container.querySelectorAll(".pc-combat-card");
    expect(cards.length).toBe(6);
  });

  it("shows proficiency, AC, speed, initiative with formatted values", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx());
    const bigs = container.querySelectorAll<HTMLDivElement>(".pc-combat-big");
    const vals = [...bigs].map((b) => b.textContent);
    expect(vals).toContain("+3");  // proficiency
    expect(vals).toContain("30");  // speed
    expect(vals).toContain("+2");  // initiative
    expect(vals).toContain("16");  // AC
  });

  it("shows HP current/max and temp suffix", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx());
    expect(container.querySelector(".pc-hp-current")?.textContent).toBe("30");
    expect(container.querySelector(".pc-hp-max")?.textContent).toBe("44");
    expect(container.querySelector(".pc-hp-temp")?.textContent).toMatch(/temp/);
  });

  it("omits temp HP when 0", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx({ hp: { max: 10, current: 10, temp: 0 } }));
    expect(container.querySelector(".pc-hp-temp")).toBeNull();
  });

  it("shows inspiration filled star when state.inspiration=true", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx({}, { state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [], inspiration: true } }));
    expect(container.querySelector(".pc-combat-inspiration-icon.filled")).not.toBeNull();
  });

  it("shows hit dice label when hit_dice populated", () => {
    const container = mountContainer();
    new CombatStatsRow().render(container, ctx({}, { state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: { d8: { used: 2, total: 5 } }, spell_slots: {}, concentration: null, conditions: [] } }));
    expect(container.querySelector(".pc-hp-hitdice")?.textContent).toContain("3/5d8");
  });
});
