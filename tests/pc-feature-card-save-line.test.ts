/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { type App } from "obsidian";

/**
 * R4-G3a §10.2.2 · the feature card's Save / DC line, rendered as TEXT and NEVER evaluated.
 *
 * `feature.dc_formula` has 208 converter carriers and they are mostly PROSE ("your spell save DC"),
 * and the SRD Dragonborn's own `save.dc_formula` spells `{prof_bonus}`, which is not a
 * `resource-formula` ident at all, so `evaluateMaxFormula` THROWS on it. The line echoes the
 * authored formula through `plainText` and the DSL is never reached. The spy below is the guard:
 * `evaluateMaxFormula` is mocked at the module boundary and asserted NEVER CALLED, so routing the
 * formula through the evaluator flips this test red whether or not the throw is swallowed.
 *
 * The fixtures deliberately carry NO `recovery` and NO `die`: the card's recovery-budget path is a
 * LEGITIMATE `evaluateMaxFormula` caller (`feature-card.ts:178`), and a fixture that reached it
 * would make the spy record a call that says nothing about the Save line.
 */
const { evaluateMaxFormula } = vi.hoisted(() => ({ evaluateMaxFormula: vi.fn(() => 0) }));
vi.mock("@archivist-gg/dnd5e/dnd/resource-formula", () => ({ evaluateMaxFormula }));

import { renderFeatureCard } from "../packages/obsidian/src/modules/pc/blocks/feature-card";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => evaluateMaxFormula.mockClear());

/** The label/value pair of the one icon-property line the card rendered. */
function propertyLines(root: HTMLElement): { label: string; value: string }[] {
  return Array.from(root.querySelectorAll(".archivist-item-properties .archivist-property-line-icon"))
    .map((line) => ({
      label: line.querySelector(".archivist-property-label")?.textContent ?? "",
      value: line.querySelector(".archivist-property-value")?.textContent ?? "",
    }));
}

describe("renderFeatureCard · the Save / DC property line (§10.2.2)", () => {
  it("renders `save` as a Save line whose formula is the authored TEXT, and never evaluates it", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Breath Weapon",
      app: {} as App,
      feature: {
        name: "Breath Weapon",
        description: "You exhale destructive energy.",
        save: { ability: "dex", dc_formula: "8 + {con_mod} + {prof_bonus}" },
      },
    });
    // The SPY first, deliberately: it is §14 row 21's declared RED, and a text assertion above it
    // would fire on the mock's return value and hide which guard actually broke.
    expect(evaluateMaxFormula).not.toHaveBeenCalled();
    expect(propertyLines(root)).toEqual([{ label: "Save:", value: "DEX · 8 + {con_mod} + {prof_bonus}" }]);
  });

  it("renders a bare `dc_formula` as a DC line carrying the prose verbatim", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Poison Spray",
      app: {} as App,
      feature: { name: "Poison Spray", dc_formula: "your spell save DC" },
    });
    expect(propertyLines(root)).toEqual([{ label: "DC:", value: "your spell save DC" }]);
    expect(evaluateMaxFormula).not.toHaveBeenCalled();
  });

  it("strips authored markup out of the echoed formula (the shared plainText path)", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Marked",
      app: {} as App,
      feature: { name: "Marked", dc_formula: "your **spell save** DC" },
    });
    expect(propertyLines(root)).toEqual([{ label: "DC:", value: "your spell save DC" }]);
  });

  it("`save` wins over a bare `dc_formula` when a feature carries both", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Both",
      app: {} as App,
      feature: {
        name: "Both",
        save: { ability: "con", dc_formula: "8 + {con_mod}" },
        dc_formula: "your spell save DC",
      },
    });
    expect(propertyLines(root)).toEqual([{ label: "Save:", value: "CON · 8 + {con_mod}" }]);
  });

  it("a feature with neither key renders NO properties block at all (the widened guard)", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Stonecunning",
      app: {} as App,
      feature: { name: "Stonecunning", description: "You know stone." },
    });
    expect(root.querySelector(".archivist-item-properties")).toBeNull();
    expect(evaluateMaxFormula).not.toHaveBeenCalled();
  });

  it("the Die line still renders, and a Save line joins it in the SAME properties block", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Breath Weapon",
      app: {} as App,
      die: "1d10",
      feature: { name: "Breath Weapon", save: { ability: "dex", dc_formula: "8 + {con_mod}" } },
    });
    expect(root.querySelectorAll(".archivist-item-properties").length).toBe(1);
    expect(propertyLines(root)).toEqual([
      { label: "Die:", value: "1d10" },
      { label: "Save:", value: "DEX · 8 + {con_mod}" },
    ]);
  });
});
