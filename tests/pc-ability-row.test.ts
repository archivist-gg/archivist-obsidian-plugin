/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { AbilityRow } from "../src/modules/pc/components/ability-row";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const derived = (): DerivedStats => ({
  totalLevel: 5,
  proficiencyBonus: 3,
  scores: { str: 8, dex: 18, con: 14, int: 12, wis: 14, cha: 13 },
  mods: { str: -1, dex: 4, con: 2, int: 1, wis: 2, cha: 1 },
  saves: {} as never,
  skills: {} as never,
  passives: { perception: 0, investigation: 0, insight: 0 },
  hp: { max: 1, current: 1, temp: 0 },
  ac: 10,
  speed: 30,
  initiative: 0,
  spellcasting: null,
  warnings: [],
});

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: derived(),
  core: {} as never,
};

describe("AbilityRow", () => {
  it("renders 6 cards in canonical order", () => {
    const container = mountContainer();
    new AbilityRow().render(container, ctx);
    const cards = container.querySelectorAll<HTMLDivElement>(".pc-ability-card");
    expect(cards.length).toBe(6);
    expect(cards[0].dataset.ability).toBe("str");
    expect(cards[5].dataset.ability).toBe("cha");
  });

  it("shows modifier and raw score", () => {
    const container = mountContainer();
    new AbilityRow().render(container, ctx);
    const dex = container.querySelector<HTMLDivElement>('[data-ability="dex"]')!;
    expect(dex.querySelector(".pc-ability-mod")?.textContent).toBe("+4");
    expect(dex.querySelector(".pc-ability-score")?.textContent).toBe("18");
  });

  it("formats negative modifiers with minus sign", () => {
    const container = mountContainer();
    new AbilityRow().render(container, ctx);
    const str = container.querySelector<HTMLDivElement>('[data-ability="str"]')!;
    expect(str.querySelector(".pc-ability-mod")?.textContent).toBe("-1");
  });
});
