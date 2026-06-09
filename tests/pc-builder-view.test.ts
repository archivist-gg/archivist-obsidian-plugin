/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { BuilderView } from "../src/modules/pc/components/builder-view";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(): ComponentRenderContext {
  return {
    resolved: { definition: { name: "Valeria", class: [] } },
    derived: { totalLevel: 0, proficiencyBonus: 2, hp: { max: 0 }, ac: 10 },
    editState: null,
  } as unknown as ComponentRenderContext;
}

describe("BuilderView shell", () => {
  it("renders six step-rail items", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    expect(root.querySelectorAll(".pc-builder-step").length).toBe(6);
  });

  it("starts on the first step (race) marked active", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    const active = root.querySelector(".pc-builder-step.active");
    expect(active?.getAttribute("data-step")).toBe("race");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("race");
  });

  it("clicking a rail item switches the active step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='abilities']")!.click();
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("abilities");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("abilities");
  });

  it("shows a Finish action on the last step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    expect(root.querySelector(".pc-builder-finish")).not.toBeNull();
  });
});
