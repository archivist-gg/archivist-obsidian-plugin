/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderResourceStrip } from "../src/modules/pc/components/actions/resource-badge";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(features: object[], featureUses: Record<string, { used: number; max: number }>, editState: object | null = null): ComponentRenderContext {
  return {
    resolved: {
      totalLevel: 5,
      classes: [{ entity: { slug: "barbarian" }, level: 5 }],
      features,
      state: { feature_uses: featureUses },
    } as never,
    derived: { proficiencyBonus: 3, mods: { str: 1, dex: 2, con: 3, int: 0, wis: 1, cha: 4 } } as never,
    core: {} as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("renderResourceStrip", () => {
  it("renders a pip badge for a non-action pool", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Rage", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
    ));
    expect(root.querySelectorAll(".pc-resource-badge").length).toBe(1);
    expect(root.textContent).toContain("Rage");
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(3);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(1);
  });

  it("renders a counter for a large pool (max > 6)", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sorcerer:sorcery-points", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sorcerer:sorcery-points": { used: 3, max: 9 } },
    ));
    expect(root.querySelectorAll(".pc-resource-counter").length).toBe(1);
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.textContent).toContain("9");
  });

  it("omits an actionable feature's first resource (shown in the table) but keeps extras", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Second Wind", action: "bonus-action", resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }] }, source: { kind: "class", slug: "fighter", level: 1 } }],
      { "fighter:second-wind": { used: 0, max: 1 } },
    ));
    expect(root.querySelectorAll(".pc-resource-badge").length).toBe(0);   // no strip, no heading
    expect(root.textContent).not.toContain("Resources");
  });

  it("counter shows remaining and the −/+ steppers spend/restore via setFeatureUse", () => {
    const root = mountContainer();
    const setFeatureUse = vi.fn();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sp", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sp": { used: 3, max: 9 } },                                   // used=3 → remaining 6/9
      { setFeatureUse },
    ));
    expect(root.querySelector(".pc-resource-counter-val")?.textContent).toBe("6/9");
    (root.querySelector(".pc-resource-step-minus") as HTMLElement).click();   // spend → used 3→4
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 4);
    (root.querySelector(".pc-resource-step-plus") as HTMLElement).click();    // restore → used 3→2
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 2);
  });
});
