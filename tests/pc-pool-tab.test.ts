/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PoolTab } from "../src/modules/pc/components/pool-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedPool } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function ofEntity(slug: string, extra: Record<string, unknown> = {}) {
  return { slug, name: slug, edition: "2014", source: "hb", feature_type: "interdict-boon",
    description: "desc-" + slug, effects: [], prerequisites: [], available_to: [], ...extra };
}

function mkCtx(pool: ResolvedPool, editState: Partial<{ setChoice: (...a: unknown[]) => void }> = {}): ComponentRenderContext {
  return {
    resolved: { pools: [pool] } as unknown as ResolvedCharacter,
    derived: {} as never, core: {} as never, app: {} as never,
    editState: editState as never,
  };
}

const basePool: ResolvedPool = {
  id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 2,
  selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare", { action_cost: "action", consumes: { resource: "seals", amount: 1 } }) as never }],
  available: [
    { slug: "baleful-glare", entity: ofEntity("baleful-glare") as never },
    { slug: "hell-mage", entity: ofEntity("hell-mage") as never },
  ],
  grants: [{ slug: "axiomatic-seals", entity: ofEntity("axiomatic-seals", { passive: true }) as never }],
};

describe("PoolTab", () => {
  it("renders a counter, selected rows, and granted rows", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-pool-count")?.textContent).toContain("1 / 2");
    expect(el.querySelectorAll(".pc-pool-row").length).toBe(2); // 1 selected + 1 grant
    expect(el.textContent).toContain("baleful-glare");
    expect(el.textContent).toContain("axiomatic-seals");
  });

  it("tags a granted/passive row and shows seal cost on the selected row", () => {
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-pool-passive")?.textContent).toMatch(/passive/i);
    expect(el.textContent).toContain("1 Seal");
  });

  it("two-tap remove writes the filtered array to the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    const rm = el.querySelector<HTMLButtonElement>(".pc-pool-remove")!;
    rm.click(); // arm
    rm.click(); // confirm
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", []);
  });

  it("opening Add lists not-yet-picked candidates; adding appends to the ledger", () => {
    const setChoice = vi.fn();
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(basePool, { setChoice }));
    el.querySelector<HTMLButtonElement>(".pc-pool-addbtn")!.click();
    const addRows = el.querySelectorAll(".pc-pool-add-row");
    expect(addRows.length).toBe(1); // hell-mage only (baleful-glare already picked)
    el.querySelector<HTMLButtonElement>(".pc-pool-add")!.click();
    expect(setChoice).toHaveBeenCalledWith(0, 2, "interdict-boons", ["baleful-glare", "hell-mage"]);
  });

  it("renders an empty-state when the pool id is unknown", () => {
    const el = mountContainer();
    new PoolTab("nope").render(el, mkCtx(basePool));
    expect(el.querySelector(".pc-empty-line")).not.toBeNull();
  });

  it("at cap: an un-picked candidate's Add button shows 'Full', is disabled, and does not write", () => {
    const setChoice = vi.fn();
    const fullPool: ResolvedPool = {
      id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 1, anchorLevel: 2,
      selected: [{ slug: "baleful-glare", entity: ofEntity("baleful-glare") as never }],
      available: [
        { slug: "baleful-glare", entity: ofEntity("baleful-glare") as never },
        { slug: "hell-mage", entity: ofEntity("hell-mage") as never },
      ],
      grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(fullPool, { setChoice }));
    el.querySelector<HTMLButtonElement>(".pc-pool-addbtn")!.click();
    const add = el.querySelector<HTMLButtonElement>(".pc-pool-add")!;
    expect(add.textContent).toBe("Full");
    expect(add.getAttribute("disabled")).toBe("true");
    add.click();
    expect(setChoice).not.toHaveBeenCalled();
  });

  it("pluralizes the consume label by amount", () => {
    const pluralPool: ResolvedPool = {
      id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 2,
      selected: [
        { slug: "two-seals", entity: ofEntity("two-seals", { consumes: { resource: "seals", amount: 2 } }) as never },
        { slug: "one-seal", entity: ofEntity("one-seal", { consumes: { resource: "seals", amount: 1 } }) as never },
      ],
      available: [], grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(pluralPool));
    const labels = [...el.querySelectorAll(".pc-pool-consume")].map((n) => n.textContent);
    expect(labels).toContain("2 Seals");
    expect(labels).toContain("1 Seal");
  });

  it("renders a structured duration label", () => {
    const durationPool: ResolvedPool = {
      id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 2,
      selected: [{ slug: "timed", entity: ofEntity("timed", { duration: { amount: 1, unit: "minute" } }) as never }],
      available: [], grants: [],
    };
    const el = mountContainer();
    new PoolTab("interdict-boons").render(el, mkCtx(durationPool));
    expect(el.querySelector(".pc-pool-duration")?.textContent).toContain("1 minute");
  });
});
