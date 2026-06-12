/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderAbilitiesStep } from "../src/modules/pc/components/builder/abilities-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

/** Read a PC style file's source so we can pin layout invariants that jsdom
 *  cannot measure (it does no layout). Resolve from the vitest root (repo root)
 *  rather than `import.meta.url` — under the jsdom environment a `new URL(…,
 *  import.meta.url)` resolves against the document base, not the module file. */
function readPcStyle(name: string): string {
  return readFileSync(resolve(process.cwd(), "src/modules/pc/styles", name), "utf8");
}

/** Extract the declaration block (`{ ... }`) of the first rule whose selector
 *  text contains `selectorFragment`. Returns "" if not found. */
function ruleBlock(css: string, selectorFragment: string): string {
  const i = css.indexOf(selectorFragment);
  if (i < 0) return "";
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  if (open < 0 || close < 0) return "";
  return css.slice(open + 1, close);
}

function mkCtx(over: {
  method?: string; abilities?: Record<string, number>; editState?: unknown;
  race?: unknown; origin_choices?: Record<string, unknown>;
  classes?: unknown[]; feats?: unknown[]; builder_rolls?: number[];
} = {}): ComponentRenderContext {
  const abilities = over.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  return {
    resolved: {
      definition: {
        name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
        abilities, ability_method: over.method ?? "manual",
        ...(over.builder_rolls ? { builder_rolls: over.builder_rolls } : {}),
        origin_choices: over.origin_choices ?? {},
        skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
        equipment: [], overrides: {},
        state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] },
      },
      race: over.race ?? null, background: null, classes: over.classes ?? [], feats: over.feats ?? [], features: [], spells: [],
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
  it("renders six obelisk tiles reusing the sheet classes, each with a Base popover control (no native select)", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx());
    expect(container.querySelectorAll(".pc-ab").length).toBe(6);
    expect(container.querySelectorAll(".pc-ab-mod").length).toBe(6);
    // Picker B-II: the Base control is a button + anchored popover, never a <select>.
    expect(container.querySelectorAll(".pc-babctl .pc-base-pop-btn").length).toBe(6);
    expect(container.querySelectorAll(".pc-babctl select").length).toBe(0);
  });

  it("manual mode: opening a Base popover and clicking a grid cell writes setAbilityBaseScore", () => {
    const container = mountContainer();
    const setAbilityBaseScore = vi.fn();
    renderAbilitiesStep(container, mkCtx({ method: "manual", editState: { setAbilityBaseScore } }));
    const btn = container.querySelector(".pc-babctl .pc-base-pop-btn") as HTMLElement;
    btn.click();
    const panel = container.querySelector(".pc-base-pop")!;
    expect(panel).not.toBeNull();
    const cell = [...panel.querySelectorAll(".pc-base-numgrid-c")].find((c) => c.textContent === "12") as HTMLElement;
    cell.click();
    expect(setAbilityBaseScore).toHaveBeenCalledWith("str", 12);
    // The write's re-render unmounts the panel; the commit also closes it.
    expect(container.querySelector(".pc-base-pop")).toBeNull();
  });

  it("species/background bonuses caption in crimson under the tile", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({
      race: { slug: "r", name: "R", ability_score_increases: [{ ability: "cha", amount: 2 }] },
    }));
    const caps = [...container.querySelectorAll(".pc-babcap .pc-bsp")];
    expect(caps.some((c) => c.textContent === "+2 species")).toBe(true);
  });

  it("class chosen-feat ability-points caption as '+N feat' in the same crimson row", () => {
    const container = mountContainer();
    // Fighter L4 ASI feat with str+2 allocation. The tile total includes the +2
    // (computeAbilityScores folds it) so the caption must reconcile it.
    renderAbilitiesStep(container, mkCtx({
      classes: [{
        entity: { slug: "srd-2024_fighter", name: "Fighter" }, level: 4, subclass: null,
        choices: { 4: { "asi-or-feat": "feat", feat: "[[srd-2024_ability-score-improvement]]", "feat:asi": { str: 2 } } },
      }],
      feats: [{
        slug: "srd-2024_ability-score-improvement", name: "Ability Score Improvement",
        choices: [{ kind: "ability-points", id: "asi", points: 2, max_per: 2 }],
      }],
    }));
    const caps = [...container.querySelectorAll(".pc-babcap .pc-bsp")];
    expect(caps.some((c) => c.textContent === "+2 feat")).toBe(true);
  });

  it("legacy class ASI-BRANCH allocation captions as '+N class' in the same crimson row", () => {
    const container = mountContainer();
    // Fighter L4 takes the plain +2 ASI branch (choices[4].asi = {str:2}). The tile
    // total folds the +2, so the caption must attribute it to the class bucket.
    renderAbilitiesStep(container, mkCtx({
      classes: [{
        entity: { slug: "srd-2024_fighter", name: "Fighter" }, level: 4, subclass: null,
        choices: { 4: { "asi-or-feat": "asi", asi: { str: 2 } } },
      }],
    }));
    const caps = [...container.querySelectorAll(".pc-babcap .pc-bsp")];
    expect(caps.some((c) => c.textContent === "+2 class")).toBe(true);
  });

  it("every tile column emits the identical structure regardless of the bonus caption", () => {
    const container = mountContainer();
    // INT gets a species bonus → a .pc-bsp caption; the other five do not. The
    // defect was exactly this asymmetry, so exercise the mixed state.
    renderAbilitiesStep(container, mkCtx({
      race: { slug: "r", name: "R", ability_score_increases: [{ ability: "int", amount: 2 }] },
    }));
    const cols = [...container.querySelectorAll(".pc-babrow > .pc-babcol")];
    expect(cols.length).toBe(6);
    // Exactly one column carries a crimson caption span — confirms the fixture
    // reproduces the mixed (some-captioned, some-not) state.
    expect(container.querySelectorAll(".pc-babcap .pc-bsp").length).toBe(1);
    // Each column carries exactly one obelisk tile + Base control + caption slot —
    // the caption span is the ONLY content that ever differs, so it must not be
    // what drives tile size. Structure (the size-bearing nodes) is uniform.
    for (const col of cols) {
      expect(col.querySelectorAll(":scope > .pc-ab").length).toBe(1);
      expect(col.querySelectorAll(":scope > .pc-babctl").length).toBe(1);
      expect(col.querySelectorAll(":scope > .pc-babcap").length).toBe(1);
      expect(col.querySelector(".pc-ab > .pc-ab-mod")).not.toBeNull();
      expect(col.querySelector(".pc-ab > .pc-ab-score")).not.toBeNull();
    }
  });
});

/** ROOT-CAUSE GUARD (smoke r1): the obelisk frame `.pc-ab` is sized
 *  `width: 100%; max-width: 72px; aspect-ratio: …` against its parent. The PC
 *  sheet wraps it in `.pc-ab-stack { width: 100% }`, so the frame always reaches
 *  its max-width. The builder's tile column `.pc-babcol` must do the SAME — give
 *  the column a defined width that fills the grid cell — otherwise it
 *  shrink-wraps to its widest child (the crimson "+N background" caption), and
 *  tiles WITHOUT a caption collapse to a cramped frame while captioned ones grow.
 *  jsdom does no layout, so we pin the fix at the CSS-rule level. */
describe("renderAbilitiesStep — uniform obelisk tile size (CSS invariant)", () => {
  it("the tile column fills its grid cell so frame width never tracks caption content", () => {
    const css = readPcStyle("builder.css");
    const col = ruleBlock(css, ".pc-babcol");
    expect(col).toMatch(/width:\s*100%/);
  });

  it("the sheet's canonical tile wrapper sets the same width:100% the builder mirrors", () => {
    const css = readPcStyle("components.css");
    const stack = ruleBlock(css, ".pc-ab-stack");
    expect(stack).toMatch(/width:\s*100%/);
  });

  /* Obsidian's app CSS styles bare `select` with a raised input dress
   * (box-shadow: var(--input-shadow), height: var(--input-height),
   * appearance, etc.) that wins on every property our sheet-scoped rule
   * omits. The `pc-bdd` rule must therefore COMPLETELY null that chrome —
   * a previous fix set background/border but left box-shadow + height
   * unanswered, so the off-white shadow box still bled through. Pin the
   * load-bearing nullifiers at the rule level (jsdom does no cascade we can
   * trust for app-CSS interplay). */
  it("the shared pc-bdd select dress defeats Obsidian's native input chrome", () => {
    const css = readPcStyle("builder.css");
    const dress = ruleBlock(css, "select.pc-bdd {");
    expect(dress).toMatch(/appearance:\s*none/);
    expect(dress).toMatch(/box-shadow:\s*none/);
    expect(dress).toMatch(/height:\s*auto/);
    expect(dress).toMatch(/background-color:\s*var\(--pc-parchment-light\)/);
  });

  it("the pc-bdd :hover state also kills Obsidian's hover shadow and hover background", () => {
    const css = readPcStyle("builder.css");
    const hover = ruleBlock(css, "select.pc-bdd:hover");
    expect(hover).toMatch(/box-shadow:\s*none/);
    expect(hover).toMatch(/background-color:\s*var\(--pc-parchment-light\)/);
  });

  /* SP2 Plan 5 smoke r5b: two layout invariants jsdom can't measure.
   * (1) The decision-row head must NOT tint on hover (user request) — it stays
   *     click-collapsible via cursor + chevron, so there must be no
   *     `.pc-dstrip-head:hover` background rule in chronicle.css.
   * (2) The chips container must center its flex children: on long-list rows
   *     the compact `Change ▸` ghost intrinsically out-measures an 11px chip,
   *     and the default `align-items: stretch` grew the chips to match it. */
  it("the decision-row head carries no hover tint (only cursor + chevron afford the toggle)", () => {
    const css = readPcStyle("chronicle.css");
    expect(css).not.toMatch(/\.pc-dstrip-head:hover\s*\{/);
    const head = ruleBlock(css, ".pc-dstrip-head {");
    expect(head).toMatch(/cursor:\s*pointer/);
  });

  it("the chips container centers its flex line so a chip never stretches to the taller Change ghost", () => {
    const css = readPcStyle("builder.css");
    const chips = ruleBlock(css, ".pc-bchoice-chips");
    expect(chips).toMatch(/align-items:\s*center/);
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

  it("point-buy: the Base popover grid excludes unaffordable values", () => {
    const container = mountContainer();
    // 15/15/15/8/8/8 = 27 spent on standard point buy → int has no headroom.
    renderAbilitiesStep(container, mkCtx({
      method: "point-buy",
      abilities: { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 },
    }));
    const btns = [...container.querySelectorAll(".pc-babctl .pc-base-pop-btn")] as HTMLElement[];
    btns[3].click(); // ABILITY_KEYS order str,dex,con,int,wis,cha → int
    const cells = [...container.querySelectorAll(".pc-base-pop .pc-base-numgrid-c")].map((c) => c.textContent);
    expect(cells).toEqual(["8"]);
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

  it("rolling persists the pool to the draft via setBuilderRolls (six totals matching the bag)", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    const setBuilderRolls = vi.fn();
    const ctx = mkCtx({ method: "rolled", editState: { setBuilderRolls } });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    (container.querySelector(".pc-broll-btn") as HTMLElement).click();
    expect(setBuilderRolls).toHaveBeenCalledTimes(1);
    const totals = setBuilderRolls.mock.calls[0][0] as number[];
    const dice = (bag.get("builder.abilities.roll") as { dice: number[][] }).dice;
    expect(totals.length).toBe(6);
    expect(totals).toEqual(dice.map((r) => r[0] + r[1] + r[2]));
  });

  it("after reopen (persisted pool, NO bag) the button reads Re-roll and renders the totals", () => {
    const container = mountContainer();
    // Fresh Map (bag absent) but the draft carries the persisted pool.
    const ctx = mkCtx({ method: "rolled", builder_rolls: [15, 14, 13, 12, 10, 8] });
    renderAbilitiesStep(container, ctx);
    expect((container.querySelector(".pc-broll-btn") as HTMLElement).textContent).toBe("Re-roll");
    const totals = [...container.querySelectorAll(".pc-broll-total")].map((t) => t.textContent);
    expect(totals).toEqual(["15", "14", "13", "12", "10", "8"]);
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

  it("rolled-method Base popover lists the full pool with duplicates honoured, ghosting values another tile already claimed", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    // Totals (top three of each, sorted desc): 15, 16, 16, 12, 13, 9.
    bag.set("builder.abilities.roll", { dice: [[6, 5, 4, 1], [6, 6, 4, 2], [6, 6, 4, 1], [4, 4, 4, 2], [5, 5, 3, 1], [3, 3, 3, 1]] });
    const ctx = mkCtx({
      method: "rolled",
      // str took one 16; two 16s in the pool → the dex popover shows one used 16 + one free 16.
      abilities: { str: 16, dex: 15, con: 10, int: 10, wis: 10, cha: 10 },
    });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    const btns = [...container.querySelectorAll(".pc-babctl .pc-base-pop-btn")] as HTMLElement[];
    btns[1].click(); // dex — its current value 15 is in the pool, so it owns a slot (no off-pool guard)
    const opts = [...container.querySelectorAll(".pc-base-pop .pc-base-pool-opt")];
    // The FULL pool is listed (six totals), not the trimmed select list.
    expect(opts.map((o) => o.textContent?.replace("✓", "").trim())).toEqual(["16", "16", "15", "13", "12", "9"]);
    // dex owns the 15 → it carries the ✓ (cur).
    const fifteen = opts.find((o) => o.textContent?.includes("15"))!;
    expect(fifteen.classList.contains("cur")).toBe(true);
    expect(fifteen.textContent).toContain("✓");
    // str claimed one 16 → exactly one 16 is ghosted `used` and inert; the other is free.
    const sixteens = opts.filter((o) => o.textContent?.includes("16"));
    expect(sixteens.filter((o) => o.classList.contains("used")).length).toBe(1);
    expect(sixteens.filter((o) => !o.classList.contains("used")).length).toBe(1);
  });

  it("rolled: clicking a free pool value writes setAbilityBaseScore; a ghosted (used) value is inert", () => {
    const container = mountContainer();
    const bag = new Map<string, unknown>();
    bag.set("builder.abilities.roll", { dice: [[6, 5, 4, 1], [6, 6, 4, 2], [6, 6, 4, 1], [4, 4, 4, 2], [5, 5, 3, 1], [3, 3, 3, 1]] });
    const setAbilityBaseScore = vi.fn();
    const ctx = mkCtx({
      method: "rolled",
      // con holds 12 (a pool value owned by con); dex's popover should ghost that 12.
      abilities: { str: 16, dex: 15, con: 12, int: 10, wis: 10, cha: 10 },
      editState: { setAbilityBaseScore },
    });
    (ctx as unknown as { builderUiState: Map<string, unknown> }).builderUiState = bag;
    renderAbilitiesStep(container, ctx);
    btns(container)[1].click(); // dex
    const opts = [...container.querySelectorAll(".pc-base-pop .pc-base-pool-opt")];
    // con's 12 is claimed by another tile → ghosted `used`, no click handler, writes nothing.
    const used = opts.find((o) => o.classList.contains("used") && o.textContent?.includes("12")) as HTMLElement;
    expect(used).toBeTruthy();
    used.click();
    expect(setAbilityBaseScore).not.toHaveBeenCalled();
    // A free value assigns and closes.
    const free = opts.find((o) => o.textContent?.includes("13") && !o.classList.contains("used")) as HTMLElement;
    free.click();
    expect(setAbilityBaseScore).toHaveBeenCalledWith("dex", 13);
    expect(container.querySelector(".pc-base-pop")).toBeNull();
  });
});

function btns(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll(".pc-babctl .pc-base-pop-btn")] as HTMLElement[];
}

describe("renderAbilitiesStep — pool-mode unassign (picker B-II)", () => {
  it("re-clicking the ✓ current value clears the base (writes 10) and closes the panel", () => {
    const container = mountContainer();
    const clearAbilityBaseScore = vi.fn();
    // str holds an assigned array value (15); dex..cha are the neutral 10.
    renderAbilitiesStep(container, mkCtx({
      method: "standard-array",
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      editState: { clearAbilityBaseScore },
    }));
    btns(container)[0].click(); // str
    const opts = [...container.querySelectorAll(".pc-base-pop .pc-base-pool-opt")];
    const cur = opts.find((o) => o.classList.contains("cur"))!;
    expect(cur.textContent).toContain("✓");
    expect(cur.textContent).toContain("15");
    (cur as HTMLElement).click(); // re-click the current → unassign
    expect(clearAbilityBaseScore).toHaveBeenCalledWith("str");
    expect(container.querySelector(".pc-base-pop")).toBeNull();
  });

  it("the explicit '– Unassign' row shows only when a value is assigned, and clears on click", () => {
    // Assigned tile (str=15) → row present.
    const c1 = mountContainer();
    const clearAbilityBaseScore = vi.fn();
    renderAbilitiesStep(c1, mkCtx({
      method: "standard-array",
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      editState: { clearAbilityBaseScore },
    }));
    btns(c1)[0].click(); // str
    const row = c1.querySelector(".pc-base-pop .pc-base-unassign") as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.textContent).toContain("Unassign");
    row.click();
    expect(clearAbilityBaseScore).toHaveBeenCalledWith("str");
    expect(c1.querySelector(".pc-base-pop")).toBeNull();

    // Unassigned tile (dex=10, the neutral sentinel) → no row.
    const c2 = mountContainer();
    renderAbilitiesStep(c2, mkCtx({
      method: "standard-array",
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }));
    btns(c2)[1].click(); // dex (still neutral 10)
    expect(c2.querySelector(".pc-base-pop")).not.toBeNull();
    expect(c2.querySelector(".pc-base-pop .pc-base-unassign")).toBeNull();
  });

  it("a freed value is selectable from another tile's panel (the slot reads `free` after clearing)", () => {
    // Before: str owns the 15 → it is `used`/inert in dex's panel.
    const before = mountContainer();
    renderAbilitiesStep(before, mkCtx({
      method: "standard-array",
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }));
    btns(before)[1].click(); // dex
    const usedFifteen = [...before.querySelectorAll(".pc-base-pop .pc-base-pool-opt")]
      .find((o) => o.textContent?.includes("15"))!;
    expect(usedFifteen.classList.contains("used")).toBe(true);

    // After clearing str (the re-render writes str back to 10), the 15 is free →
    // selectable from dex's panel and assigns.
    const after = mountContainer();
    const setAbilityBaseScore = vi.fn();
    renderAbilitiesStep(after, mkCtx({
      method: "standard-array",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      editState: { setAbilityBaseScore },
    }));
    btns(after)[1].click(); // dex
    const freeFifteen = [...after.querySelectorAll(".pc-base-pop .pc-base-pool-opt")]
      .find((o) => o.textContent?.includes("15"))! as HTMLElement;
    expect(freeFifteen.classList.contains("used")).toBe(false);
    freeFifteen.click();
    expect(setAbilityBaseScore).toHaveBeenCalledWith("dex", 15);
  });

  it("manual mode shows no Unassign row (the tile always holds a value)", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "manual", abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }));
    btns(container)[0].click(); // str
    expect(container.querySelector(".pc-base-pop")).not.toBeNull();
    expect(container.querySelector(".pc-base-pop .pc-base-unassign")).toBeNull();
  });
});

describe("renderAbilitiesStep — rolled pool persists on the draft (SP2 Plan 5)", () => {
  it("the Base popover draws its pool from the persisted builder_rolls even when the bag is absent", () => {
    const container = mountContainer();
    // str took a 15; dex is unassigned. The bag is a FRESH empty Map (the
    // reopen case) — only the draft's builder_rolls carries the pool.
    const ctx = mkCtx({
      method: "rolled",
      builder_rolls: [16, 15, 14, 12, 10, 8],
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    renderAbilitiesStep(container, ctx);
    btns(container)[1].click(); // dex
    const opts = [...container.querySelectorAll(".pc-base-pop .pc-base-pool-opt")];
    // The FULL persisted pool is listed (six totals) despite no bag.
    expect(opts.map((o) => o.textContent?.replace("✓", "").trim())).toEqual(["16", "15", "14", "12", "10", "8"]);
    // str claimed the 15 → that slot is ghosted `used`/inert in dex's panel.
    const fifteen = opts.find((o) => o.textContent?.includes("15"))!;
    expect(fifteen.classList.contains("used")).toBe(true);
  });

  it("an unassigned value is still offered (free) from the persisted pool after clearing, bag absent", () => {
    // Models: roll → str took 15 → unassign str (clearAbilityBaseScore wrote 10)
    // → re-render arrives with str=10 and the bag GONE. The 15 must be free again.
    const container = mountContainer();
    const setAbilityBaseScore = vi.fn();
    const ctx = mkCtx({
      method: "rolled",
      builder_rolls: [16, 15, 14, 12, 10, 8],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, // str just unassigned
      editState: { setAbilityBaseScore },
    });
    renderAbilitiesStep(container, ctx);
    btns(container)[0].click(); // str — the freed value should be re-offerable
    const opts = [...container.querySelectorAll(".pc-base-pop .pc-base-pool-opt")];
    const fifteen = opts.find((o) => o.textContent?.includes("15")) as HTMLElement;
    expect(fifteen.classList.contains("used")).toBe(false); // free, re-assignable
    fifteen.click();
    expect(setAbilityBaseScore).toHaveBeenCalledWith("str", 15);
  });
});

describe("renderAbilitiesStep — Base popover (picker B-II)", () => {
  it("clicking the Base box opens an anchored parchment panel; clicking the same box again closes it", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "manual" }));
    const btn = container.querySelector(".pc-babctl .pc-base-pop-btn") as HTMLElement;
    expect(container.querySelector(".pc-base-pop")).toBeNull();
    btn.click();
    const panel = container.querySelector(".pc-base-pop")!;
    expect(panel).not.toBeNull();
    expect(panel.querySelector(".pc-base-pop-arrow")).not.toBeNull(); // caret notch
    btn.click(); // toggle closed
    expect(container.querySelector(".pc-base-pop")).toBeNull();
  });

  it("manual grid spans the real 3–20 range (not the mockup's illustrative 3–18)", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "manual" }));
    (container.querySelector(".pc-babctl .pc-base-pop-btn") as HTMLElement).click();
    const cells = [...container.querySelectorAll(".pc-base-pop .pc-base-numgrid-c")].map((c) => Number(c.textContent));
    expect(cells[0]).toBe(3);
    expect(cells.at(-1)).toBe(20);
    expect(cells.length).toBe(18); // 3..20 inclusive
  });

  it("only one panel is open at a time: opening a second tile's Base closes the first", () => {
    const container = mountContainer();
    renderAbilitiesStep(container, mkCtx({ method: "manual" }));
    const btns = [...container.querySelectorAll(".pc-babctl .pc-base-pop-btn")] as HTMLElement[];
    btns[0].click();
    expect(container.querySelectorAll(".pc-base-pop").length).toBe(1);
    btns[1].click();
    // Still exactly one panel; it now belongs to the second anchor.
    expect(container.querySelectorAll(".pc-base-pop").length).toBe(1);
    expect(btns[1].parentElement!.querySelector(".pc-base-pop")).not.toBeNull();
    expect(btns[0].parentElement!.querySelector(".pc-base-pop")).toBeNull();
  });

  it("Escape closes the panel with no write", () => {
    const container = mountContainer();
    const setAbilityBaseScore = vi.fn();
    renderAbilitiesStep(container, mkCtx({ method: "manual", editState: { setAbilityBaseScore } }));
    (container.querySelector(".pc-babctl .pc-base-pop-btn") as HTMLElement).click();
    expect(container.querySelector(".pc-base-pop")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(container.querySelector(".pc-base-pop")).toBeNull();
    expect(setAbilityBaseScore).not.toHaveBeenCalled();
  });

  it("an outside click closes the panel with no write", () => {
    const container = mountContainer();
    const setAbilityBaseScore = vi.fn();
    renderAbilitiesStep(container, mkCtx({ method: "manual", editState: { setAbilityBaseScore } }));
    (container.querySelector(".pc-babctl .pc-base-pop-btn") as HTMLElement).click();
    expect(container.querySelector(".pc-base-pop")).not.toBeNull();
    document.body.click(); // outside the panel + trigger
    expect(container.querySelector(".pc-base-pop")).toBeNull();
    expect(setAbilityBaseScore).not.toHaveBeenCalled();
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
