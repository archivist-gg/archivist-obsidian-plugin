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

  it("hides Back on the first step and the Back button returns to the previous step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    expect(root.querySelector(".pc-builder-back")).toBeNull();
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='class']")!.click();
    root.querySelector<HTMLElement>(".pc-builder-back")!.click();
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("race");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("race");
  });

  it("honors ctx.activeStepId over the default first step", () => {
    const root = mountContainer();
    const c = { ...ctx(), activeStepId: "abilities" } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("abilities");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("abilities");
  });

  it("fires onActiveStepChange on rail clicks and Back/Next", () => {
    const root = mountContainer();
    const seen: string[] = [];
    const c = { ...ctx(), onActiveStepChange: (id: string) => seen.push(id) } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='class']")!.click();
    root.querySelector<HTMLElement>(".pc-builder-back")!.click();
    root.querySelector<HTMLElement>(".pc-builder-next")!.click();
    expect(seen).toEqual(["class", "race", "class"]);
  });

  it("holds no instance state: a second render with a fresh ctx starts at race", () => {
    const root = mountContainer();
    const view = new BuilderView();
    view.render(root, { ...ctx(), activeStepId: "details" } as unknown as ComponentRenderContext);
    const rootB = mountContainer();
    view.render(rootB, ctx());
    expect(rootB.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("race");
  });
});
