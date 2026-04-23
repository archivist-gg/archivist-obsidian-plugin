/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SavesPanel } from "../src/modules/pc/components/saves-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {
    proficiencyBonus: 3, totalLevel: 5,
    scores: { str: 8, dex: 18, con: 14, int: 12, wis: 14, cha: 13 },
    mods: { str: -1, dex: 4, con: 2, int: 1, wis: 2, cha: 1 },
    saves: {
      str: { bonus: -1, proficient: false },
      dex: { bonus: 7, proficient: true },
      con: { bonus: 2, proficient: false },
      int: { bonus: 4, proficient: true },
      wis: { bonus: 2, proficient: false },
      cha: { bonus: 1, proficient: false },
    },
    skills: {} as never,
    passives: { perception: 0, investigation: 0, insight: 0 },
    hp: { max: 1, current: 1, temp: 0 }, ac: 10, speed: 30, initiative: 0,
    spellcasting: null, warnings: [],
  } as DerivedStats,
  core: {} as never,
};

describe("SavesPanel", () => {
  it("renders six save rows", () => {
    const container = mountContainer();
    new SavesPanel().render(container, ctx);
    expect(container.querySelectorAll(".pc-save-row").length).toBe(6);
  });

  it("marks proficient saves with filled dot", () => {
    const container = mountContainer();
    new SavesPanel().render(container, ctx);
    const dex = [...container.querySelectorAll<HTMLDivElement>(".pc-save-row")]
      .find((r) => r.querySelector(".pc-save-name")?.textContent === "DEX");
    expect(dex?.querySelector(".pc-prof-dot.filled")).not.toBeNull();
  });

  it("non-proficient saves have an empty dot", () => {
    const container = mountContainer();
    new SavesPanel().render(container, ctx);
    const str = [...container.querySelectorAll<HTMLDivElement>(".pc-save-row")]
      .find((r) => r.querySelector(".pc-save-name")?.textContent === "STR");
    expect(str?.querySelector(".pc-prof-dot")?.classList.contains("filled")).toBe(false);
  });

  it("renders signed bonuses", () => {
    const container = mountContainer();
    new SavesPanel().render(container, ctx);
    const bonuses = [...container.querySelectorAll(".pc-save-bonus")].map((b) => b.textContent);
    expect(bonuses).toContain("+7");
    expect(bonuses).toContain("-1");
  });
});
