/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderActiveEffectsRail } from "../src/modules/pc/components/active-effects-rail";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderActiveEffectsRail", () => {
  it("renders nothing when there are no items", () => {
    const el = mountContainer();
    renderActiveEffectsRail(el, []);
    expect(el.querySelector(".pc-ae-rail")).toBeNull();
  });

  it("renders one framed pc-panel tile per item with label + name", () => {
    const el = mountContainer();
    renderActiveEffectsRail(el, [
      { label: "Concentration", name: "Bless", icon: "brain", onEnd: () => {} },
      { label: "Active boon", name: "Shadow Shroud", onEnd: () => {} },
    ]);
    expect(el.querySelectorAll(".pc-ae-tile.pc-panel").length).toBe(2);
    expect(el.querySelector(".pc-ae-label")?.textContent).toBe("Concentration");
    expect([...el.querySelectorAll(".pc-ae-name")].map((n) => n.textContent)).toEqual(["Bless", "Shadow Shroud"]);
  });

  it("calls onEnd when the tile's end button is clicked", () => {
    const onEnd = vi.fn();
    const el = mountContainer();
    renderActiveEffectsRail(el, [{ label: "Active boon", name: "Shadow Shroud", onEnd }]);
    el.querySelector<HTMLButtonElement>(".pc-ae-end")!.click();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
