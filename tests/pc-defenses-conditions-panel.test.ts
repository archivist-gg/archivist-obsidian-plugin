/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { DefensesConditionsPanel } from "../src/modules/pc/components/defenses-conditions-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

type Defenses = ComponentRenderContext["derived"]["defenses"];
function ctx(p: { defenses?: Defenses; conditions?: string[]; exhaustion?: number; editState?: unknown } = {}): ComponentRenderContext {
  return {
    derived: {
      defenses: p.defenses ?? {
        resistances: [], immunities: [], vulnerabilities: [], condition_immunities: [],
      },
    },
    resolved: { state: { conditions: p.conditions ?? [], exhaustion: p.exhaustion ?? 0 } },
    editState: p.editState,
  } as unknown as ComponentRenderContext;
}

describe("DefensesConditionsPanel", () => {
  it("wraps both columns in a single .pc-panel with merged class", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelectorAll(".pc-panel.pc-def-cond").length).toBe(1);
    expect(root.querySelectorAll(".pc-def-cond-left").length).toBe(1);
    expect(root.querySelectorAll(".pc-def-cond-right").length).toBe(1);
  });

  it("renders all four property-lines when all populated", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: ["fire", "cold"],
        immunities: ["poison"],
        vulnerabilities: ["radiant"],
        condition_immunities: ["charmed"],
      },
    }));
    const left = root.querySelector(".pc-def-cond-left");
    expect(left?.textContent).toContain("Damage Resistances");
    expect(left?.textContent).toContain("fire, cold");
    expect(left?.textContent).toContain("Damage Immunities");
    expect(left?.textContent).toContain("poison");
    expect(left?.textContent).toContain("Damage Vulnerabilities");
    expect(left?.textContent).toContain("radiant");
    expect(left?.textContent).toContain("Condition Immunities");
    expect(left?.textContent).toContain("charmed");
  });

  it("shows 'none' once when all four categories are empty", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelector(".pc-def-cond-empty")?.textContent).toBe("none");
  });

  it("renders active condition chips + static + button", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ conditions: ["prone", "poisoned"] }));
    const chips = [...root.querySelectorAll(".pc-cond-chip")];
    // Chip label is the PascalCase display name (Bug 5)
    expect(chips.map((c) => c.querySelector(".pc-cond-chip-label")?.textContent)).toEqual([
      "Prone",
      "Poisoned",
    ]);
    expect(root.querySelector("button.pc-cond-add")?.textContent).toBe("+");
  });

  it("each chip mounts an svg icon (Bug 5)", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ conditions: ["poisoned"] }));
    const chip = root.querySelector(".pc-cond-chip");
    expect(chip?.querySelector(".pc-cond-chip-icon svg")).not.toBeNull();
  });

  it("shows 'no active conditions' placeholder when empty, still renders + button", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelector(".pc-cond-empty")?.textContent).toBe("no active conditions");
    expect(root.querySelector("button.pc-cond-add")).not.toBeNull();
  });

  it("renders an exhaustion chip when state.exhaustion > 0 (Bug 4)", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 5 }));
    const chip = root.querySelector(".pc-cond-chip-exhaustion");
    expect(chip).not.toBeNull();
    expect(chip?.querySelector(".pc-cond-chip-label")?.textContent).toBe("Exhaustion 5");
    // Exhaustion icon mounts an svg
    expect(chip?.querySelector(".pc-cond-chip-icon svg")).not.toBeNull();
    // Empty placeholder must not appear when exhaustion is non-zero
    expect(root.querySelector(".pc-cond-empty")).toBeNull();
  });

  it("does NOT render exhaustion chip when level is 0", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 0 }));
    expect(root.querySelector(".pc-cond-chip-exhaustion")).toBeNull();
  });

  it("renders both exhaustion and condition chips together", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 2, conditions: ["prone"] }));
    expect(root.querySelector(".pc-cond-chip-exhaustion .pc-cond-chip-label")?.textContent).toBe("Exhaustion 2");
    const cond = [...root.querySelectorAll(".pc-cond-chip:not(.pc-cond-chip-exhaustion)")];
    expect(cond.length).toBe(1);
    expect(cond[0].querySelector(".pc-cond-chip-label")?.textContent).toBe("Prone");
  });
});
