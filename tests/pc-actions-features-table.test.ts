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
});
