/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { StatsTiles } from "../src/modules/pc/components/stats-tiles";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(over: Partial<{ prof: number; init: number; speed: number; insp: number }> = {}): ComponentRenderContext {
  return {
    derived: {
      proficiencyBonus: over.prof ?? 5,
      initiative: over.init ?? 2,
      speed: over.speed ?? 30,
    },
    resolved: { state: { inspiration: over.insp ?? 2 } },
  } as unknown as ComponentRenderContext;
}

describe("StatsTiles", () => {
  it("renders 4 tiles: PROFICIENCY / INITIATIVE / SPEED / INSPIRATION", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    const tiles = [...root.querySelectorAll(".pc-stats-tile")];
    expect(tiles.length).toBe(4);
    const labels = tiles.map((t) => t.querySelector(".pc-stats-tile-lbl")?.textContent);
    expect(labels).toEqual(["PROFICIENCY", "INITIATIVE", "SPEED", "INSPIRATION"]);
  });

  it("shows +5 / +2 / 30ft / 2 for given stats", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx({ prof: 5, init: 2, speed: 30, insp: 2 }));
    expect(root.querySelector(".pc-stats-tile[data-stat='prof'] .pc-stats-tile-val")?.textContent).toBe("+5");
    expect(root.querySelector(".pc-stats-tile[data-stat='init'] .pc-stats-tile-val")?.textContent).toBe("+2");
    expect(root.querySelector(".pc-stats-tile[data-stat='speed'] .pc-stats-tile-val")?.textContent).toBe("30ft");
    expect(root.querySelector(".pc-stats-tile[data-stat='insp'] .pc-stats-tile-ct")?.textContent).toBe("2");
  });

  it("INSPIRATION tile has − and + buttons inline with the count", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    const insp = root.querySelector(".pc-stats-tile[data-stat='insp']");
    expect(insp?.querySelector("button.pc-insp-minus")?.textContent).toBe("−");
    expect(insp?.querySelector("button.pc-insp-plus")?.textContent).toBe("+");
  });

  it("each tile has the shared .pc-panel class (hairline border)", () => {
    const root = mountContainer();
    new StatsTiles().render(root, ctx());
    expect(root.querySelectorAll(".pc-panel.pc-stats-tile").length).toBe(4);
  });
});
