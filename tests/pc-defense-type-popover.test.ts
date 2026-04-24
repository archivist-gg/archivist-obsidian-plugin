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

describe("openDefenseTypePopover", () => {
  it("resistances kind lists all damage types", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "resistances", ctx);
    const popover = document.body.querySelector(".pc-def-popover");
    expect(popover).not.toBeNull();
    const rows = popover!.querySelectorAll(".pc-def-popover-row");
    // DAMAGE_TYPES has 13 entries (Acid..Thunder)
    expect(rows.length).toBe(13);
  });

  it("condition_immunities kind lists the CONDITION_SLUGS", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "condition_immunities", ctx);
    const rows = document.body.querySelectorAll(".pc-def-popover-row");
    // 14 base conditions
    expect(rows.length).toBe(14);
  });

  it("row click on a damage resistance calls addDefense", () => {
    const { ctx, editState } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "resistances", ctx);
    const rows = document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row");
    rows[0].querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.addDefense).toHaveBeenCalledWith("resistances", expect.any(String));
  });

  it("row click on already-active damage resistance calls removeDefense", () => {
    const { ctx, editState } = mkCtx({ resistances: ["fire"] });
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "resistances", ctx);
    const rows = [...document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row")];
    const fireRow = rows.find((r) => /fire/i.test(r.textContent ?? ""))!;
    fireRow.querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.removeDefense).toHaveBeenCalledWith("resistances", "fire");
  });

  it("row click on condition immunity calls addConditionImmunity with slug", () => {
    const { ctx, editState } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "condition_immunities", ctx);
    const rows = [...document.body.querySelectorAll<HTMLElement>(".pc-def-popover-row")];
    const charmedRow = rows.find((r) => /charmed/i.test(r.textContent ?? ""))!;
    charmedRow.querySelector<HTMLElement>(".pc-def-popover-toggle")!.click();
    expect(editState.addConditionImmunity).toHaveBeenCalledWith("charmed");
  });

  it("Escape closes the popover", () => {
    const { ctx } = mkCtx();
    const anchor = document.body.appendChild(document.createElement("button"));
    openDefenseTypePopover(anchor, "resistances", ctx);
    expect(document.body.querySelector(".pc-def-popover")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.body.querySelector(".pc-def-popover")).toBeNull();
  });
});
