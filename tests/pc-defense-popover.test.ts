/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  openDefenseTypePopover,
  closeDefenseTypePopover,
} from "../src/modules/pc/components/defense-type-popover";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { DAMAGE_TYPES } from "../src/shared/dnd/constants";
import {
  CONDITION_SLUGS,
  CONDITION_DISPLAY_NAMES,
} from "../src/modules/pc/constants/conditions";
import { FIGHTER_5_CLERIC_3, clone, fakeResolved, fakeDerived } from "./fixtures/pc/rest-fixtures";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { App } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

function withDefenses(over: Partial<{
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  condition_immunities: string[];
}> = {}) {
  const character = clone(FIGHTER_5_CLERIC_3);
  const resolved = fakeResolved(character);
  const derived = fakeDerived(character) as { hp: { max: number; current: number; temp: number }; defenses: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; condition_immunities: string[] } };
  derived.defenses = {
    resistances: over.resistances ?? [],
    immunities: over.immunities ?? [],
    vulnerabilities: over.vulnerabilities ?? [],
    condition_immunities: over.condition_immunities ?? [],
  };
  const onChange = vi.fn();
  const editState = new CharacterEditState(character, () => ({ resolved, derived: derived as never }), onChange);
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  const ctx: ComponentRenderContext = {
    resolved,
    derived: derived as never,
    core: {} as never,
    app: {} as App,
    editState,
  };
  return { ctx, editState, anchor, character, onChange };
}

function getPopover(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>(".pc-def-popover");
  if (!el) throw new Error("popover not rendered");
  return el;
}

function damageRow(name: string): HTMLElement {
  const popover = getPopover();
  for (const row of popover.querySelectorAll<HTMLElement>(".pc-def-popover-section:nth-of-type(1) .pc-def-popover-row")) {
    if (row.querySelector(".pc-def-popover-name")?.textContent === name) return row;
  }
  throw new Error(`damage row "${name}" not found`);
}

function pip(row: HTMLElement, kind: "resistance" | "immunity" | "vulnerability"): HTMLButtonElement {
  const el = row.querySelector<HTMLButtonElement>(`.pc-def-popover-pip[data-kind="${kind}"]`);
  if (!el) throw new Error(`pip "${kind}" not found`);
  return el;
}

function conditionRow(slug: string): HTMLElement {
  const popover = getPopover();
  for (const row of popover.querySelectorAll<HTMLElement>(".pc-def-popover-section:nth-of-type(2) .pc-def-popover-row")) {
    if (row.dataset.slug === slug) return row;
  }
  throw new Error(`condition row "${slug}" not found`);
}

describe("defense popover — structure", () => {
  it("renders two sections with correct headers", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const popover = getPopover();
    const headers = Array.from(popover.querySelectorAll(".pc-def-popover-section-header"));
    expect(headers.map((h) => h.textContent?.trim().toLowerCase())).toEqual([
      expect.stringContaining("damage types"),
      expect.stringContaining("condition immunities"),
    ]);
    closeDefenseTypePopover();
  });

  it("renders one damage-type row per DAMAGE_TYPES entry, each with three pips", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const damageRows = getPopover().querySelectorAll(".pc-def-popover-section:nth-of-type(1) .pc-def-popover-row");
    expect(damageRows.length).toBe(DAMAGE_TYPES.length);
    for (const row of damageRows) {
      expect(row.querySelectorAll(".pc-def-popover-pip").length).toBe(3);
    }
    closeDefenseTypePopover();
  });

  it("renders one condition row per CONDITION_SLUGS entry, each with one checkbox", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const condRows = getPopover().querySelectorAll(".pc-def-popover-section:nth-of-type(2) .pc-def-popover-row");
    expect(condRows.length).toBe(CONDITION_SLUGS.length);
    for (const row of condRows) {
      expect(row.querySelectorAll(".pc-def-popover-checkbox").length).toBe(1);
    }
    closeDefenseTypePopover();
  });

  it("displays condition rows by their CONDITION_DISPLAY_NAMES label", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const charmedRow = conditionRow("charmed");
    expect(charmedRow.querySelector(".pc-def-popover-name")?.textContent).toBe(CONDITION_DISPLAY_NAMES.charmed);
    closeDefenseTypePopover();
  });
});

describe("defense popover — initial state mirrors derived.defenses", () => {
  it("an `.on` pip appears for each existing entry", () => {
    const { ctx, anchor } = withDefenses({
      resistances: ["acid"],
      immunities: ["cold"],
      vulnerabilities: ["fire"],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Acid"), "resistance").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Acid"), "immunity").classList.contains("on")).toBe(false);
    expect(pip(damageRow("Cold"), "immunity").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Fire"), "vulnerability").classList.contains("on")).toBe(true);
    closeDefenseTypePopover();
  });

  it("a checked checkbox appears for each existing condition immunity", () => {
    const { ctx, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    openDefenseTypePopover(anchor, ctx);
    const cb = conditionRow("charmed").querySelector<HTMLInputElement>(".pc-def-popover-checkbox")!;
    expect(cb.checked).toBe(true);
    closeDefenseTypePopover();
  });
});

describe("defense popover — pip clicks", () => {
  it("tap R on a neutral row calls addDefense(resistances, slug)", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("resistances", "acid");
    closeDefenseTypePopover();
  });

  it("tap I on a resistance row removes then adds", () => {
    const { ctx, editState, anchor } = withDefenses({ resistances: ["acid"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "acid");
    expect(addSpy).toHaveBeenCalledWith("immunities", "acid");
    // Order: remove before add.
    const removeOrder = removeSpy.mock.invocationCallOrder[0];
    const addOrder = addSpy.mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(addOrder);
    closeDefenseTypePopover();
  });

  it("tap the active pip clears the row", () => {
    const { ctx, editState, anchor } = withDefenses({ immunities: ["cold"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Cold"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("immunities", "cold");
    expect(addSpy).not.toHaveBeenCalled();
    closeDefenseTypePopover();
  });

  it("re-render after click reflects the new state", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    // Click handler should refresh the row in place.
    expect(pip(damageRow("Acid"), "resistance").classList.contains("on")).toBe(true);
    closeDefenseTypePopover();
  });
});

describe("defense popover — viewport clamp", () => {
  it("invokes the clamp after rendering both sections (right-edge anchor stays inside)", () => {
    const { ctx, anchor } = withDefenses();
    // Force the anchor near the right edge of jsdom's window (defaults 1024×768).
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    anchor.getBoundingClientRect = () => ({
      bottom: 100, top: 80, left: 990, right: 1020,
      width: 30, height: 20, x: 990, y: 80, toJSON() { return this; },
    } as DOMRect);
    openDefenseTypePopover(anchor, ctx);
    const popover = getPopover();
    // Clamp's margin is 8px → popover.right must be ≤ 1016px.
    const rect = popover.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(1016);
    closeDefenseTypePopover();
  });
});

describe("defense popover — condition checkboxes", () => {
  it("ticking an unchecked checkbox calls addConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    const cb = conditionRow("charmed").querySelector<HTMLInputElement>(".pc-def-popover-checkbox")!;
    cb.click();
    expect(spy).toHaveBeenCalledWith("charmed");
    closeDefenseTypePopover();
  });

  it("unticking a checked checkbox calls removeConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    const spy = vi.spyOn(editState, "removeConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    const cb = conditionRow("charmed").querySelector<HTMLInputElement>(".pc-def-popover-checkbox")!;
    cb.click();
    expect(spy).toHaveBeenCalledWith("charmed");
    closeDefenseTypePopover();
  });
});
