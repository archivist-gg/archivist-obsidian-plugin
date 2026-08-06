/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import {
  openDefenseTypePopover,
  closeDefenseTypePopover,
} from "../packages/obsidian/src/modules/pc/components/defense-type-popover";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import { DAMAGE_TYPES } from "@archivist-gg/dnd5e/dnd/constants";
import {
  CONDITION_SLUGS,
  CONDITION_DISPLAY_NAMES,
} from "@archivist-gg/dnd5e/pc/conditions.constants";
import { FIGHTER_5_CLERIC_3, clone, fakeResolved, fakeDerived } from "./fixtures/pc/rest-fixtures";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { App } from "obsidian";

beforeAll(() => installObsidianDomHelpers());
afterEach(() => closeDefenseTypePopover());

type Derived = ComponentRenderContext["derived"];
type DefenseEntry = Derived["defenses"]["resistances"][number];

type DefenseSeed = string | DefenseEntry;

/**
 * Seed a bucket with `DefenseEntry` objects. `value` is the canonical slug;
 * `label` is the first-spelling-wins display string.
 *
 * A BARE STRING seeds `label === value`. Under that seed a canonical `value`
 * compare and a `label` compare are indistinguishable, which is exactly why
 * bug D-1 shipped green: every fixture in the file spelled both fields the
 * same way. Pass a full entry whenever the test needs to tell them apart ·
 * `{ value: "psychic", label: "Psychic", origin: "grant" }`.
 */
function ents(vals: DefenseSeed[]): DefenseEntry[] {
  return vals.map((v) =>
    typeof v === "string" ? { value: v, label: v, origin: "manual" as const } : v,
  );
}

function withDefenses(over: Partial<{
  resistances: DefenseSeed[];
  immunities: DefenseSeed[];
  vulnerabilities: DefenseSeed[];
  condition_immunities: DefenseSeed[];
}> = {}) {
  const character = clone(FIGHTER_5_CLERIC_3);
  const resolved = fakeResolved(character);
  // Typed against the REAL `DerivedStats` (via ComponentRenderContext) so the
  // `defenses` seeding below is checked against the engine shape rather than a
  // hand-written local one that can silently drift out of date.
  const derived = fakeDerived(character) as Derived;
  derived.defenses = {
    resistances: ents(over.resistances ?? []),
    immunities: ents(over.immunities ?? []),
    vulnerabilities: ents(over.vulnerabilities ?? []),
    condition_immunities: ents(over.condition_immunities ?? []),
  };
  const onChange = vi.fn();
  const editState = new CharacterEditState(character, () => ({ resolved, derived }), onChange);
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  const ctx: ComponentRenderContext = {
    resolved,
    derived,
    services: {} as never,
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

function tab(name: "damages" | "conditions"): HTMLButtonElement {
  const el = getPopover().querySelector<HTMLButtonElement>(`.pc-def-popover-tab[data-tab="${name}"]`);
  if (!el) throw new Error(`tab "${name}" not found`);
  return el;
}

function panel(name: "damages" | "conditions"): HTMLElement {
  const el = getPopover().querySelector<HTMLElement>(`.pc-def-popover-panel[data-tab="${name}"]`);
  if (!el) throw new Error(`panel "${name}" not found`);
  return el;
}

function damageRow(name: string): HTMLElement {
  for (const row of panel("damages").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
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
  for (const row of panel("conditions").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
    if (row.dataset.slug === slug) return row;
  }
  throw new Error(`condition row "${slug}" not found`);
}

function conditionPip(slug: string): HTMLButtonElement {
  return pip(conditionRow(slug), "immunity");
}

describe("defense popover — structure", () => {
  it("renders two tabs labeled Damages and Conditions, Damages active by default", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(tab("damages").textContent).toBe("Damages");
    expect(tab("conditions").textContent).toBe("Conditions");
    expect(tab("damages").classList.contains("active")).toBe(true);
    expect(tab("conditions").classList.contains("active")).toBe(false);
  });

  it("damages panel is active by default; conditions panel is not", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(panel("damages").classList.contains("active")).toBe(true);
    expect(panel("conditions").classList.contains("active")).toBe(false);
  });

  it("renders one damage-type row per DAMAGE_TYPES entry, each with three pips", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const damageRows = panel("damages").querySelectorAll(".pc-def-popover-row");
    expect(damageRows.length).toBe(DAMAGE_TYPES.length);
    for (const row of damageRows) {
      expect(row.querySelectorAll(".pc-def-popover-pip").length).toBe(3);
    }
  });

  it("renders one condition row per CONDITION_SLUGS entry, each with a single immunity pip", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const condRows = panel("conditions").querySelectorAll(".pc-def-popover-row");
    expect(condRows.length).toBe(CONDITION_SLUGS.length);
    for (const row of condRows) {
      const pips = row.querySelectorAll<HTMLButtonElement>(".pc-def-popover-pip");
      expect(pips.length).toBe(1);
      expect(pips[0].dataset.kind).toBe("immunity");
      expect(pips[0].textContent).toBe("I");
    }
  });

  it("displays condition rows by their CONDITION_DISPLAY_NAMES label", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(conditionRow("charmed").querySelector(".pc-def-popover-name")?.textContent).toBe(
      CONDITION_DISPLAY_NAMES.charmed,
    );
  });
});

describe("defense popover — tab switching", () => {
  it("clicking the Conditions tab swaps the active tab + panel", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    tab("conditions").click();
    expect(tab("conditions").classList.contains("active")).toBe(true);
    expect(tab("damages").classList.contains("active")).toBe(false);
    expect(panel("conditions").classList.contains("active")).toBe(true);
    expect(panel("damages").classList.contains("active")).toBe(false);
  });

  it("clicking back to Damages restores the default", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    tab("conditions").click();
    tab("damages").click();
    expect(tab("damages").classList.contains("active")).toBe(true);
    expect(panel("damages").classList.contains("active")).toBe(true);
    expect(panel("conditions").classList.contains("active")).toBe(false);
  });
});

describe("defense popover — initial state mirrors derived.defenses", () => {
  it("an `.on` pip appears for each existing damage entry", () => {
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
  });

  it("an `.on` immunity pip appears for each existing condition immunity", () => {
    const { ctx, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    openDefenseTypePopover(anchor, ctx);
    expect(conditionPip("charmed").classList.contains("on")).toBe(true);
  });
});

describe("defense popover · seeding keys on the canonical value (bug D-1)", () => {
  it("checks the R pip for a Title-Case granted resistance", () => {
    const { ctx, anchor } = withDefenses({
      resistances: [{ value: "psychic", label: "Psychic", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Psychic"), "resistance").classList.contains("on")).toBe(true);
  });

  it("checks the I and V pips for Title-Case granted damage entries", () => {
    const { ctx, anchor } = withDefenses({
      immunities: [{ value: "cold", label: "Cold", origin: "grant" }],
      vulnerabilities: [{ value: "fire", label: "Fire", origin: "equipment" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(pip(damageRow("Cold"), "immunity").classList.contains("on")).toBe(true);
    expect(pip(damageRow("Fire"), "vulnerability").classList.contains("on")).toBe(true);
  });

  it("checks the immunity pip for a Title-Case granted condition immunity", () => {
    const { ctx, anchor } = withDefenses({
      condition_immunities: [{ value: "charmed", label: "Charmed", origin: "grant" }],
    });
    openDefenseTypePopover(anchor, ctx);
    expect(conditionPip("charmed").classList.contains("on")).toBe(true);
  });

  // A pip that mis-seeds OFF turns one tap into `addDefense` on a value the
  // character already has, writing a manual duplicate of a grant into the note.
  // Seeding ON makes the same tap the intended `removeDefense`.
  it("tapping a Title-Case granted resistance removes it instead of adding a duplicate", () => {
    const { ctx, editState, anchor } = withDefenses({
      resistances: [{ value: "psychic", label: "Psychic", origin: "grant" }],
    });
    const addSpy = vi.spyOn(editState, "addDefense");
    const removeSpy = vi.spyOn(editState, "removeDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Psychic"), "resistance").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "psychic");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("addresses every damage row by its canonical value in data-type", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    expect(damageRow("Psychic").dataset.type).toBe("psychic");
    for (const row of panel("damages").querySelectorAll<HTMLElement>(".pc-def-popover-row")) {
      const shown = row.querySelector(".pc-def-popover-name")?.textContent ?? "";
      expect(row.dataset.type).toBe(shown.toLowerCase());
    }
  });
});

describe("defense popover — damage pip clicks", () => {
  it("tap R on a neutral row calls addDefense(resistances, slug)", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("resistances", "acid");
  });

  it("tap I on a resistance row removes then adds", () => {
    const { ctx, editState, anchor } = withDefenses({ resistances: ["acid"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("resistances", "acid");
    expect(addSpy).toHaveBeenCalledWith("immunities", "acid");
    const removeOrder = removeSpy.mock.invocationCallOrder[0];
    const addOrder = addSpy.mock.invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(addOrder);
  });

  it("tap the active pip clears the row", () => {
    const { ctx, editState, anchor } = withDefenses({ immunities: ["cold"] });
    const removeSpy = vi.spyOn(editState, "removeDefense");
    const addSpy = vi.spyOn(editState, "addDefense");
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Cold"), "immunity").click();
    expect(removeSpy).toHaveBeenCalledWith("immunities", "cold");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("re-render after click reflects the new state", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    pip(damageRow("Acid"), "resistance").click();
    expect(pip(damageRow("Acid"), "resistance").classList.contains("on")).toBe(true);
  });
});

describe("defense popover — condition pip clicks", () => {
  it("tap on a neutral condition row calls addConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses();
    const spy = vi.spyOn(editState, "addConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    conditionPip("charmed").click();
    expect(spy).toHaveBeenCalledWith("charmed");
  });

  it("tap on an active condition row calls removeConditionImmunity", () => {
    const { ctx, editState, anchor } = withDefenses({ condition_immunities: ["charmed"] });
    const spy = vi.spyOn(editState, "removeConditionImmunity");
    openDefenseTypePopover(anchor, ctx);
    conditionPip("charmed").click();
    expect(spy).toHaveBeenCalledWith("charmed");
  });

  it("re-render after click toggles `.on` in place", () => {
    const { ctx, anchor } = withDefenses();
    openDefenseTypePopover(anchor, ctx);
    const p = conditionPip("charmed");
    expect(p.classList.contains("on")).toBe(false);
    p.click();
    expect(p.classList.contains("on")).toBe(true);
    p.click();
    expect(p.classList.contains("on")).toBe(false);
  });
});

describe("defense popover — viewport clamp", () => {
  it("invokes the clamp after rendering both panels (right-edge anchor stays inside)", () => {
    const { ctx, anchor } = withDefenses();
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
    anchor.getBoundingClientRect = () => ({
      bottom: 100, top: 80, left: 990, right: 1020,
      width: 30, height: 20, x: 990, y: 80, toJSON() { return this; },
    } as DOMRect);
    openDefenseTypePopover(anchor, ctx);
    const popover = getPopover();
    const rect = popover.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(1016);
  });
});
