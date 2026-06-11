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

describe("renderAbilitiesStep — point-buy bar", () => {
  it("shows spent/left meter for archivist point buy (all-10 = 12 spent, 16 left)", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "archivist-point-buy" }));
    const bar = container.querySelector(".pc-bctx");
    expect(bar?.textContent).toContain("12 of 28 spent");
    expect(bar?.textContent).toContain("16 left");
    expect(container.querySelector(".pc-bmeter-fill")).toBeTruthy();
  });

  it("renders the cost legend chips for the active rule", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "archivist-point-buy" }));
    const chips = [...container.querySelectorAll(".pc-bcost > span")];
    expect(chips.some((c) => c.textContent?.includes("7") && c.textContent?.includes("-1"))).toBe(true);
    expect(chips.some((c) => c.textContent?.includes("16") && c.textContent?.includes("11"))).toBe(true);
  });

  it("base dropdowns exclude unaffordable values", () => {
    const container = mountContainer();
    // 15/15/15/8/8/8 = 27 spent on standard point buy → int has no headroom.
    renderAbilitiesStep(container, mkCtx({
      method: "point-buy",
      abilities: { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 },
    }));
    const selects = [...container.querySelectorAll(".pc-babctl select")] as HTMLSelectElement[];
    const intSel = selects[3]; // ABILITY_KEYS order str,dex,con,int,wis,cha
    expect([...intSel.options].map((o) => o.value)).toEqual(["8"]);
  });

  it("renders no context bar for the manual method", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "manual" }));
    expect(container.querySelector(".pc-bctx")).toBeNull();
  });
});

describe("renderAbilitiesStep — standard array bar", () => {
  it("lists unassigned array values as pool chips", () => {
    const container = mountContainer();
    // str=15 assigned → pool shows 14,13,12,8 unassigned (10 consumed once by the three 10s).
    renderAbilitiesStep(container, mkCtx({
      method: "standard-array",
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }));
    const chips = [...container.querySelectorAll(".pc-bpool-chip")];
    // 10 appears three times in scores but only once in the array → consumed once.
    expect(chips.map((c) => c.textContent)).toEqual(["14", "13", "12", "8"]);
  });
});

describe("renderAbilitiesStep — roll bar", () => {
  it("shows the Roll button; rolling fills the session pool with six 4d6-drop-lowest results", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    const ctx = mkCtx({ method: "rolled" });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    (container.querySelector(".pc-broll-btn") as HTMLElement).click();
    const pool = bag.get("builder.abilities.roll") as { dice: number[][] } | undefined;
    expect(pool?.dice.length).toBe(6);
    for (const roll of pool!.dice) {
      expect(roll.length).toBe(4);
      for (const d of roll) { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(6); }
    }
  });

  it("renders rolled results as dice chips with the lowest struck and the kept total", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    bag.set("builder.abilities.roll", { dice: [[6, 5, 4, 1], [3, 3, 2, 2], [6, 6, 6, 1], [4, 4, 3, 2], [5, 4, 2, 1], [2, 2, 2, 1]] });
    const ctx = mkCtx({ method: "rolled" });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    const first = container.querySelector(".pc-broll-set");
    expect(first?.querySelectorAll(".pc-broll-die").length).toBe(4);
    expect(first?.querySelectorAll(".pc-broll-die.strike").length).toBe(1);
    expect(first?.querySelector(".pc-broll-total")?.textContent).toBe("15"); // 6+5+4
  });

  it("rolled-method dropdowns offer the unconsumed pool totals, with duplicates honoured", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    // Totals (top three of each, sorted desc): 15, 16, 16, 12, 13, 9.
    bag.set("builder.abilities.roll", { dice: [[6, 5, 4, 1], [6, 6, 4, 2], [6, 6, 4, 1], [4, 4, 4, 2], [5, 5, 3, 1], [3, 3, 3, 1]] });
    const ctx = mkCtx({
      method: "rolled",
      // str already took one 16; two 16s in the pool → the other dropdown must still offer 16.
      abilities: { str: 16, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    const selects = [...container.querySelectorAll(".pc-babctl select")] as HTMLSelectElement[];
    // str (index 0) already holds 16; its own value stays selectable + one 16 remains in the pool.
    const dexOpts = [...selects[1].options].map((o) => o.value);
    expect(dexOpts).toContain("16"); // second 16 still assignable
    expect(dexOpts).toContain("15");
    expect(dexOpts).toContain("13");
    expect(dexOpts).toContain("12");
    expect(dexOpts).toContain("9");
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
