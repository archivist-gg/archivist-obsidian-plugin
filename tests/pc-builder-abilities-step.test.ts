/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderAbilitiesStep } from "../src/modules/pc/components/builder/abilities-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function mkCtx(over: {
  method?: string; abilities?: Record<string, number>; editState?: unknown;
  race?: unknown; origin_choices?: Record<string, unknown>;
} = {}): ComponentRenderContext {
  const abilities = over.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  return {
    resolved: {
      definition: {
        name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
        abilities, ability_method: over.method ?? "manual",
        origin_choices: over.origin_choices ?? {},
        skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
        equipment: [], overrides: {},
        state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
      },
      race: over.race ?? null, background: null, classes: [], feats: [], features: [], spells: [],
    },
    // Real DerivedStats fields are `scores` (final totals) + `mods`.
    derived: { scores: abilities, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } },
    core: { plugin: {}, entities: { search: () => [] }, compendiums: { getAll: () => [] }, modules: { getByEntityType: () => undefined } },
    editState: over.editState ?? null,
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderAbilitiesStep — tabs", () => {
  it("renders the five method pills plus the ✦ Custom tab, current method dressed .on", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "point-buy" }));
    const tabs = [...container.querySelectorAll(".pc-bmtab")];
    expect(tabs.length).toBe(6);
    expect(tabs.find((t) => t.textContent?.includes("Standard Point Buy"))?.classList.contains("on")).toBe(true);
    expect(container.querySelector(".pc-bmtab.ai")?.textContent).toContain("Custom");
    expect(container.querySelector(".pc-bmtab .pc-bhb")?.textContent).toBe("Homebrew");
  });

  it("clicking a pill writes setAbilityMethod", () => {
    const container = mountContainer();
    const setAbilityMethod = vi.fn();
    renderAbilitiesStep(container, mkCtx({ editState: { setAbilityMethod } }));
    const pill = [...container.querySelectorAll(".pc-bmtab")].find((t) => t.textContent?.includes("Standard Array"));
    (pill as HTMLElement).click();
    expect(setAbilityMethod).toHaveBeenCalledWith("standard-array");
  });
});

describe("renderAbilitiesStep — tiles", () => {
  it("renders six obelisk tiles reusing the sheet classes, with Base dropdowns", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx());
    expect(container.querySelectorAll(".pc-ab").length).toBe(6);
    expect(container.querySelectorAll(".pc-ab-mod").length).toBe(6);
    expect(container.querySelectorAll(".pc-babctl select").length).toBe(6);
  });

  it("changing a Base dropdown writes setAbilityBaseScore", () => {
    const container = mountContainer();
    const setAbilityBaseScore = vi.fn();
    renderAbilitiesStep(container, mkCtx({ editState: { setAbilityBaseScore } }));
    const sel = container.querySelector(".pc-babctl select") as HTMLSelectElement;
    sel.value = "12";
    sel.dispatchEvent(new Event("change"));
    expect(setAbilityBaseScore).toHaveBeenCalledWith("str", 12);
  });

  it("species/background bonuses caption in crimson under the tile", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({
      race: { slug: "r", name: "R", ability_score_increases: [{ ability: "cha", amount: 2 }] },
    }));
    const caps = [...container.querySelectorAll(".pc-babcap .pc-bsp")];
    expect(caps.some((c) => c.textContent === "+2 species")).toBe(true);
  });
});

describe("renderAbilitiesStep — custom (Plan 6 hand-off)", () => {
  it("toggling the ✦ Custom tab shows the inert Inquiry prompt box", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx());
    expect(container.querySelector(".pc-baibox")).toBeNull();
    (container.querySelector(".pc-bmtab.ai") as HTMLElement).click();
    const box = container.querySelector(".pc-baibox");
    expect(box).not.toBeNull();
    const btn = box!.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
