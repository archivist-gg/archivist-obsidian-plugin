/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import {
  openDefenseTypePopover,
  closeDefenseTypePopover,
} from "../src/modules/pc/components/defense-type-popover";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function resetBody() {
  while (document.body.firstChild) document.body.firstChild.remove();
}

beforeEach(() => {
  closeDefenseTypePopover();
  resetBody();
});

function mkCtx(defenses?: Partial<ComponentRenderContext["derived"]["defenses"]>) {
  const editState = {
    addDefense: vi.fn(),
    removeDefense: vi.fn(),
    addConditionImmunity: vi.fn(),
    removeConditionImmunity: vi.fn(),
  };
  return {
    ctx: {
      derived: {
        defenses: {
          resistances: [], immunities: [], vulnerabilities: [],
          condition_immunities: [],
          ...(defenses ?? {}),
        },
      },
      editState,
    } as unknown as ComponentRenderContext,
    editState,
  };
}

describe("openDefenseTypePopover — tabbed picker (SP4b)", () => {
  it("renders four kind tabs + resistance list by default", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    const popover = document.body.querySelector(".pc-def-popover");
    expect(popover).not.toBeNull();
    const tabs = popover!.querySelectorAll(".pc-def-popover-tab");
    expect(tabs.length).toBe(4);
    // Default active tab is "resistances"
    const active = popover!.querySelector(".pc-def-popover-tab.active");
    expect(active?.getAttribute("data-kind")).toBe("resistances");
    // Default list shows 13 damage types
    expect(popover!.querySelectorAll(".pc-def-popover-row").length).toBe(13);
  });

  it("clicking the Condition Imm. tab swaps the list to 14 conditions", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    const tab = document.body.querySelector<HTMLElement>(".pc-def-popover-tab[data-kind='condition_immunities']")!;
    tab.click();
    expect(tab.classList.contains("active")).toBe(true);
    expect(document.body.querySelectorAll(".pc-def-popover-row").length).toBe(14);
  });

  it("row click on the resistance tab calls addDefense('resistances', ...)", () => {
    const { ctx, editState } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    const rows = document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row");
    rows[0].querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.addDefense).toHaveBeenCalledWith("resistances", expect.any(String));
  });

  it("row click on an already-active resistance calls removeDefense", () => {
    const { ctx, editState } = mkCtx({ resistances: ["fire"] });
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    const fireRow = [...document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row")]
      .find((r) => /fire/i.test(r.textContent ?? ""))!;
    fireRow.querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.removeDefense).toHaveBeenCalledWith("resistances", "fire");
  });

  it("switching to immunities tab then clicking fire calls addDefense('immunities', 'fire')", () => {
    const { ctx, editState } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    document.body.querySelector<HTMLElement>(".pc-def-popover-tab[data-kind='immunities']")!.click();
    const fireRow = [...document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row")]
      .find((r) => /fire/i.test(r.textContent ?? ""))!;
    fireRow.querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.addDefense).toHaveBeenCalledWith("immunities", "fire");
  });

  it("condition immunity toggle calls addConditionImmunity with slug", () => {
    const { ctx, editState } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    document.body.querySelector<HTMLElement>(".pc-def-popover-tab[data-kind='condition_immunities']")!.click();
    const charmedRow = [...document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row")]
      .find((r) => /charmed/i.test(r.textContent ?? ""))!;
    charmedRow.querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.addConditionImmunity).toHaveBeenCalledWith("charmed");
  });

  it("Escape closes the popover", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, ctx);
    expect(document.body.querySelector(".pc-def-popover")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.querySelector(".pc-def-popover")).toBeNull();
  });
});
