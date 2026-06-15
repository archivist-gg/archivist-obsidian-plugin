/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { FeaturesTable } from "../src/modules/pc/components/actions/features-table";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithFeatures(features: object[], featureUses: Record<string, { used: number; max: number }> = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      features,
      state: { feature_uses: featureUses },
    } as never,
    derived: { attacks: [] } as never,
    core: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("FeaturesTable", () => {
  it("only renders features with action cost defined", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
      { id: "fighting-style", name: "Fighting Style", description: "Defense" },
    ]));
    const rows = root.querySelectorAll(".pc-action-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Second Wind");
  });

  it("renders charge boxes for features with resources", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures(
      [{
        id: "second-wind", name: "Second Wind", action: "bonus-action",
        description: "Heal", resources: [{ id: "second-wind", name: "uses", max_formula: "1", reset: "short-rest" }],
      }],
      { "second-wind": { used: 1, max: 1 } },
    ));
    const boxes = root.querySelectorAll(".archivist-toggle-box");
    expect(boxes.length).toBe(1);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(1);
  });

  it("clicking a feature row marks it .pc-row-open (and unmarks on re-click)", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
    ]));
    const row = () => root.querySelector(".pc-action-row") as HTMLElement;
    expect(row().classList.contains("pc-row-open")).toBe(false);
    row().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row().classList.contains("pc-row-open")).toBe(true);
    row().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(row().classList.contains("pc-row-open")).toBe(false);
  });

  it("clicking pip dispatches editState.expendFeatureUse", () => {
    const root = mountContainer();
    const expendFeatureUse = vi.fn();
    const restoreFeatureUse = vi.fn();
    new FeaturesTable().render(root, {
      ...ctxWithFeatures(
        [{
          id: "action-surge", name: "Action Surge", action: "free", description: "Extra action",
          resources: [{ id: "action-surge", name: "uses", max_formula: "1", reset: "short-rest" }],
        }],
        { "action-surge": { used: 0, max: 1 } },
      ),
      editState: { expendFeatureUse, restoreFeatureUse } as never,
    });
    const empty = root.querySelector(".archivist-toggle-box:not(.archivist-toggle-box-checked)") as HTMLElement;
    empty.click();
    expect(expendFeatureUse).toHaveBeenCalledWith("action-surge");
  });

  it("renders rows as divs, not a <table>", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
    ]));
    expect(root.querySelector("table")).toBeNull();
    expect(root.querySelector(".pc-action-row")?.tagName).toBe("DIV");
  });

  it("expands as a full-width sibling div carrying the open tint", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
    ]));
    (root.querySelector(".pc-action-row") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const expand = root.querySelector(".pc-action-expand") as HTMLElement;
    expect(expand).not.toBeNull();
    expect(expand.tagName).toBe("DIV");
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    expect(root.querySelector("table")).toBeNull();
  });

  it("renders an active-buff toggle + duration label on an activatable action-feature and toggles via editState", () => {
    const root = mountContainer();
    const toggleActiveBuff = vi.fn();
    new FeaturesTable().render(root, {
      ...ctxWithFeatures([
        {
          id: "majesty", name: "Infernal Majesty", action: "bonus-action", description: "Aura of dread.",
          activatable: true, duration: { amount: 1, unit: "minute" }, effects: [{ kind: "ac-bonus", value: 2 }],
        },
      ]),
      editState: { toggleActiveBuff } as never,
    });
    const toggle = root.querySelector<HTMLInputElement>(".pc-action-buff-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle!.checked).toBe(false);
    expect(root.querySelector(".pc-action-buff-duration")?.textContent).toContain("1 minute");
    toggle!.checked = true;
    toggle!.dispatchEvent(new Event("change"));
    expect(toggleActiveBuff).toHaveBeenCalledWith("majesty");
  });

  it("reflects an active buff as checked from state.active_buffs", () => {
    const root = mountContainer();
    const ctx = ctxWithFeatures([
      { id: "majesty", name: "Infernal Majesty", action: "bonus-action", description: "...", activatable: true },
    ]);
    (ctx.resolved as unknown as { state: { active_buffs: string[] } }).state.active_buffs = ["majesty"];
    new FeaturesTable().render(root, ctx);
    expect(root.querySelector<HTMLInputElement>(".pc-action-buff-toggle")!.checked).toBe(true);
  });

  it("does NOT render a buff toggle on a non-activatable feature", () => {
    const root = mountContainer();
    new FeaturesTable().render(root, ctxWithFeatures([
      { id: "second-wind", name: "Second Wind", action: "bonus-action", description: "Heal 1d10+5" },
    ]));
    expect(root.querySelector(".pc-action-buff-toggle")).toBeNull();
  });
});
