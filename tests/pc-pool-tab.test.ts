/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PoolTab } from "../src/modules/pc/components/pool-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function ofEntity(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug, name: slug, edition: "2014", source: "hb", feature_type: "interdict-boon",
    description: "desc-" + slug, effects: [], prerequisites: [{ kind: "level", min: 2 }], available_to: [], ...extra,
  };
}

type EditStub = Partial<{
  setChoice: (...a: unknown[]) => void;
  toggleActiveBuff: (slug: string) => void;
}>;

function mkCtx(pool: ResolvedPool, editState: EditStub = {}, activeBuffs: string[] = []): ComponentRenderContext {
  return {
    resolved: { pools: [pool], state: { active_buffs: activeBuffs } } as unknown as ResolvedCharacter,
    derived: {} as never, core: {} as never, app: {} as never,
    editState: editState as never,
  };
}

const basePool: ResolvedPool = {
  id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 2,
  selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare", { action_cost: "action", consumes: { resource: "seals", amount: 1 } }) as never }],
  available: [
    { slug: "baleful-glare", entity: ofEntity("baleful-glare", { action_cost: "action", consumes: { resource: "seals", amount: 1 } }) as never },
    { slug: "hell-mage", entity: ofEntity("hell-mage") as never },
  ],
  grants: [{ slug: "axiomatic-seals", entity: ofEntity("axiomatic-seals", { passive: true }) as never }],
};

describe("PoolTab — spell-like", () => {
  it("renders a 'Known X / N' counter", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-spell-counts")?.textContent).toContain("1 / 2");
  });

  it("groups candidates into a level band and renders a row per available boon", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-actions-section-head")?.textContent).toContain("Level 2");
    // 2 available + 1 granted = 3 rows
    expect(el.querySelectorAll(".pc-spell-prep-row").length).toBe(3);
    expect(el.textContent).toContain("baleful-glare");
    expect(el.textContent).toContain("hell-mage");
  });

  it("checks the toggle box of an already-selected boon and leaves others unchecked", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const checked = el.querySelectorAll(".archivist-toggle-box.archivist-toggle-box-checked");
    expect(checked.length).toBe(1); // only baleful-glare (the grant has no toggle box)
  });

  it("clicking an unselected boon's box appends it to the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    // hell-mage row is the 2nd available; find its box (not checked)
    const boxes = el.querySelectorAll<HTMLElement>(".pc-spell-list .archivist-toggle-box");
    const unchecked = [...boxes].find((b) => !b.classList.contains("archivist-toggle-box-checked"))!;
    unchecked.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", ["baleful-glare", "hell-mage"]);
  });

  it("clicking a selected boon's box removes it from the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    const checked = el.querySelector<HTMLElement>(".archivist-toggle-box.archivist-toggle-box-checked")!;
    checked.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", []);
  });

  it("at cap, unselected boxes are locked and do not write", () => {
    const setChoice = vi.fn();
    const fullPool: ResolvedPool = {
      ...basePool, count: 1,
      selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare") as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(fullPool, { setChoice }));
    const locked = el.querySelector<HTMLElement>(".archivist-toggle-box.pc-box-locked")!;
    expect(locked).not.toBeNull();
    locked.click();
    expect(setChoice).not.toHaveBeenCalled();
  });

  it("shows the consume cost in the row's meta sub-line", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.textContent).toContain("1 Seal");
  });

  it("clicking a name expands a plain-text description", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const nameWrap = el.querySelector<HTMLElement>(".pc-spell-namewrap")!;
    nameWrap.click();
    expect(el.querySelector(".pc-spell-expand")?.textContent).toContain("desc-");
  });

  it("renders a granted row tagged 'granted' with no toggle box", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    const grantHead = [...el.querySelectorAll(".pc-actions-section-head")].find((h) => h.textContent?.includes("Granted"));
    expect(grantHead).toBeTruthy();
    expect(el.querySelector(".pc-spell-always")?.textContent).toMatch(/granted/i);
  });

  it("marks the counter .over when selections exceed the cap", () => {
    const overPool: ResolvedPool = {
      ...basePool, count: 1,
      selected: [
        { slug: "a", entity: ofEntity("a") as never },
        { slug: "b", entity: ofEntity("b") as never },
      ],
      available: [], grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(overPool));
    expect(el.querySelector(".pc-spell-counts b.over")).not.toBeNull();
  });

  it("renders an inline Active control on a selected activatable boon and toggles it", () => {
    const toggleActiveBuff = vi.fn();
    const actPool: ResolvedPool = {
      ...basePool, count: 2,
      selected: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      available: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(actPool, { toggleActiveBuff }));
    const actv = el.querySelector<HTMLButtonElement>(".pc-pool-active")!;
    expect(actv.textContent).toBe("Activate");
    actv.click();
    expect(toggleActiveBuff).toHaveBeenCalledWith("majesty");
  });

  it("shows an active boon in the active-effects rail", () => {
    const actPool: ResolvedPool = {
      ...basePool, count: 2,
      selected: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      available: [{ slug: "majesty", entity: ofEntity("majesty", { activatable: true }) as never }],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(actPool, {}, ["majesty"]));
    expect(el.querySelector(".pc-ae-tile .pc-ae-name")?.textContent).toBe("majesty");
  });

  it("renders an empty-state when the pool id is unknown", () => {
    const el = mountContainer();
    new PoolTab("nope").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-empty-line")).not.toBeNull();
  });

  it("has no reaver/boon literals leaking into rendered text beyond the data", () => {
    // genericity smoke: the component must not invent labels; it only echoes data.
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.textContent).not.toContain("Interdict Boons"); // pool.label is NOT shown as a heading anymore
  });
});
