/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ActionsTab } from "../src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function mkResolved(): ResolvedCharacter {
  return {
    definition: {
      name: "T", edition: "2014", race: null, subrace: null, background: null,
      class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual",
      skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
      equipment: [
        { item: "[[shortsword]]", equipped: true },
        { item: "Burglar's pack with rope", equipped: true },
      ],
      overrides: {},
      state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: { d8: { used: 1, total: 3 } }, spell_slots: {}, concentration: null, conditions: [], death_saves: { successes: 1, failures: 2 } },
    } as never,
    race: null, classes: [], background: null, feats: [], totalLevel: 3,
    features: [{
      feature: { name: "Second Wind", grants_resource: "second-wind" } as never,
      source: { kind: "class", slug: "fighter", level: 1 },
    }],
    state: { hp: { current: 10, max: 10, temp: 0 }, hit_dice: { d8: { used: 1, total: 3 } }, spell_slots: {}, concentration: null, conditions: [], death_saves: { successes: 1, failures: 2 } },
  };
}

const ctx: ComponentRenderContext = {
  resolved: mkResolved(),
  derived: {} as DerivedStats,
  core: {} as never,
  editState: null,
};

describe("ActionsTab", () => {
  it("renders attack table with weapon-like equipment", () => {
    const container = mountContainer();
    new ActionsTab().render(container, ctx);
    const names = [...container.querySelectorAll(".pc-attack-name")].map((n) => n.textContent);
    expect(names).toContain("Shortsword");
  });

  it("omits non-weapon equipment from the attack table", () => {
    const container = mountContainer();
    new ActionsTab().render(container, ctx);
    const names = [...container.querySelectorAll(".pc-attack-name")].map((n) => n.textContent);
    expect(names.find((n) => n?.toLowerCase().includes("burglar"))).toBeUndefined();
  });

  it("renders a resource badge for grants_resource features", () => {
    const container = mountContainer();
    new ActionsTab().render(container, ctx);
    expect(container.querySelector(".pc-resource-badge")?.textContent).toContain("Second Wind");
  });

  it("shows hit dice remaining/total", () => {
    const container = mountContainer();
    new ActionsTab().render(container, ctx);
    expect(container.querySelector(".pc-hd-entry")?.textContent).toBe("2/3 d8");
  });

  it("renders death saves with the correct dots filled", () => {
    const container = mountContainer();
    new ActionsTab().render(container, ctx);
    const rows = container.querySelectorAll(".pc-ds-row");
    const succFilled = rows[0].querySelectorAll(".pc-ds-dot.filled").length;
    const failFilled = rows[1].querySelectorAll(".pc-ds-dot.filled").length;
    expect(succFilled).toBe(1);
    expect(failFilled).toBe(2);
  });
});
