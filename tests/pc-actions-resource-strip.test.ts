/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderResourceList } from "../src/modules/pc/components/actions/resource-badge";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(
  features: object[],
  featureUses: Record<string, { used: number; max: number }>,
  editState: object | null = null,
  extra: {
    spellSlots?: Record<number, { used: number; total: number }>;
    derivedSpellSlots?: Record<number, number>;
  } = {},
): ComponentRenderContext {
  return {
    resolved: {
      totalLevel: 5,
      classes: [{ entity: { slug: "barbarian" }, level: 5 }],
      features,
      state: { feature_uses: featureUses, spell_slots: extra.spellSlots },
    } as never,
    derived: {
      proficiencyBonus: 3,
      mods: { str: 1, dex: 2, con: 3, int: 0, wis: 1, cha: 4 },
      derivedSpellSlots: extra.derivedSpellSlots,
    } as never,
    core: {} as never,
    app: {} as never,
    editState: editState as never,
  };
}

describe("renderResourceList", () => {
  it("renders one row per resource with the recovery suffix after the tracker (max≤6 → pips)", () => {
    const root = mountContainer();
    renderResourceList(root, ctx(
      [{ feature: { name: "Rage", description: "You can rage.", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
    ));
    expect(root.querySelectorAll(".pc-resource-row").length).toBe(1);
    expect(root.querySelector(".pc-resource-row-name")?.textContent).toBe("Rage");
    // recovery suffix sits after the tracker, mirroring the item charge style
    const reset = root.querySelector(".pc-resource-row .pc-charge-recovery");
    expect(reset).toBeTruthy();
    expect(reset?.textContent).toBe("/ Long Rest");
    // pips for max≤6, inside the track wrapper
    expect(root.querySelectorAll(".pc-resource-track .archivist-toggle-box").length).toBe(3);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(1);
    // the heading renders when there are entries
    expect(root.querySelector(".pc-tab-heading")?.textContent).toBe("Resources");
  });

  it("renders a counter for a large pool (max > 6)", () => {
    const root = mountContainer();
    renderResourceList(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sorcerer:sorcery-points", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sorcerer:sorcery-points": { used: 3, max: 9 } },
    ));
    expect(root.querySelectorAll(".pc-resource-counter").length).toBe(1);
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.querySelector(".pc-resource-counter-val")?.textContent).toBe("6/9");
  });

  it("renders the die label next to the name when present", () => {
    const root = mountContainer();
    renderResourceList(root, ctx(
      [{ feature: { name: "Bardic Inspiration", resources: [{ id: "bard:bi", name: "Bardic Inspiration", max_formula: "4", reset: "short-rest", die: { base: "d8" } }] }, source: { kind: "class", slug: "bard", level: 1 } }],
      { "bard:bi": { used: 0, max: 4 } },
    ));
    expect(root.querySelector(".pc-resource-die")?.textContent).toBe("d8");
    expect(root.querySelector(".pc-resource-row .pc-charge-recovery")?.textContent).toBe("/ Short Rest");
  });

  it("clicking a row reveals its expand block with the feature description", () => {
    const root = mountContainer();
    renderResourceList(root, ctx(
      [{ feature: { name: "Rage", description: "In battle, you fight with primal ferocity.", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
    ));
    const row = root.querySelector(".pc-resource-row") as HTMLElement;
    const expand = row.nextElementSibling as HTMLElement;
    expect(expand.classList.contains("pc-resource-expand")).toBe(true);
    expect((expand as HTMLElement & { hidden: boolean }).hidden).toBe(true);

    row.click();
    expect((expand as HTMLElement & { hidden: boolean }).hidden).toBe(false);
    expect(row.classList.contains("open")).toBe(true);
    // the expand uses the SAME card UI as the spell/item block
    const block = expand.querySelector(".archivist-item-block");
    expect(block).toBeTruthy();
    expect(block?.querySelector(".archivist-item-name")?.textContent).toBe("Rage");
    expect(block?.querySelector(".archivist-item-description")?.textContent).toContain("primal ferocity");
    // source label is the italic subtitle; recharge cadence is an info property
    expect(block?.querySelector(".archivist-item-subtitle")?.textContent).toContain("Barbarian");
    expect(block?.textContent).toContain("Long Rest");
    // the surrounding panel background/border is NOT applied to the expand itself
    expect((expand as HTMLElement).style.background === "" || (expand as HTMLElement).style.background === "transparent").toBe(true);
  });

  it("toggles .pc-row-open on the row when it opens/closes (track clicks do not)", () => {
    const root = mountContainer();
    const expendFeatureUse = vi.fn();
    renderResourceList(root, ctx(
      [{ feature: { name: "Rage", description: "x", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
      { expendFeatureUse },
    ));
    const row = root.querySelector(".pc-resource-row") as HTMLElement;
    expect(row.classList.contains("pc-row-open")).toBe(false);
    // the expand panel carries the shared open tint so the row + card read as one unit
    const expand = row.nextElementSibling as HTMLElement;
    expect(expand.classList.contains("pc-open-expand")).toBe(true);
    // open via a row click (not on the track)
    row.click();
    expect(row.classList.contains("pc-row-open")).toBe(true);
    // close again
    row.click();
    expect(row.classList.contains("pc-row-open")).toBe(false);
    // a usage-track click must NOT toggle the open tint
    const pip = root.querySelectorAll(".pc-resource-track .archivist-toggle-box")[2] as HTMLElement;
    pip.click();
    expect(row.classList.contains("pc-row-open")).toBe(false);
  });

  it("clicking the usage tracker spends without expanding the row", () => {
    const root = mountContainer();
    const expendFeatureUse = vi.fn();
    renderResourceList(root, ctx(
      [{ feature: { name: "Rage", description: "x", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
      { expendFeatureUse },
    ));
    const row = root.querySelector(".pc-resource-row") as HTMLElement;
    const expand = row.nextElementSibling as HTMLElement & { hidden: boolean };
    // click an unchecked pip inside the track → spends, does NOT expand
    const pip = root.querySelectorAll(".pc-resource-track .archivist-toggle-box")[2] as HTMLElement;
    pip.click();
    expect(expendFeatureUse).toHaveBeenCalled();
    expect(expand.hidden).toBe(true);
    expect(row.classList.contains("open")).toBe(false);
  });

  it("the counter −/+ steppers spend/restore via setFeatureUse and don't expand", () => {
    const root = mountContainer();
    const setFeatureUse = vi.fn();
    renderResourceList(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sp", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sp": { used: 3, max: 9 } },
      { setFeatureUse },
    ));
    const row = root.querySelector(".pc-resource-row") as HTMLElement;
    const expand = row.nextElementSibling as HTMLElement & { hidden: boolean };
    (root.querySelector(".pc-resource-step-minus") as HTMLElement).click();   // spend → used 3→4
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 4);
    (root.querySelector(".pc-resource-step-plus") as HTMLElement).click();    // restore → used 3→2
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 2);
    expect(expand.hidden).toBe(true);   // stepper clicks don't expand
  });

  it("omits an actionable feature's first resource (shown in the table)", () => {
    const root = mountContainer();
    renderResourceList(root, ctx(
      [{ feature: { name: "Second Wind", action: "bonus-action", resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }] }, source: { kind: "class", slug: "fighter", level: 1 } }],
      { "fighter:second-wind": { used: 0, max: 1 } },
    ));
    expect(root.querySelectorAll(".pc-resource-row").length).toBe(0);   // no list, no heading
    expect(root.textContent).not.toContain("Resources");
  });

  it("dedups a resource granted at multiple levels into a single row", () => {
    const root = mountContainer();
    const bardic = () => ({
      feature: { name: "Bardic Inspiration", resources: [{ id: "bard:bardic-inspiration", name: "Bardic Inspiration", max_formula: "{cha_mod}", reset: "short-rest" }] },
      source: { kind: "class", slug: "bard", level: 1 },
    });
    renderResourceList(root, ctx(
      [bardic(), bardic()],                                  // same id granted twice (levels 1 and 5)
      { "bard:bardic-inspiration": { used: 0, max: 4 } },
    ));
    expect(root.querySelectorAll(".pc-resource-row").length).toBe(1);   // not 2
    expect(root.querySelectorAll(".pc-resource-row-name").length).toBe(1);
  });
});

describe("renderResourceList — recovery action", () => {
  // Arcane Recovery: non-actionable pool, used 0 < max 1, recovery amount "4".
  // Expended slot state: L1=2, L3=1.  Budget = 4 slot-levels.
  const FEATURE = {
    feature: {
      name: "Arcane Recovery",
      description: "You have learned to regain some of your magical energy by studying your spellbook.",
      resources: [{
        id: "wizard:arcane-recovery",
        name: "Arcane Recovery",
        max_formula: "1",
        reset: "long-rest",
        recovery: [{ name: "Recover slots", amount: "4" }],
      }],
    },
    source: { kind: "class", slug: "wizard", level: 1 },
  };
  const FEATURE_USES = { "wizard:arcane-recovery": { used: 0, max: 1 } };
  const DERIVED_SLOTS = { 1: 4, 3: 3, 6: 1 };
  const SLOT_STATE = { 1: { used: 2, total: 4 }, 3: { used: 1, total: 3 } };

  function mount(editState: object | null = null) {
    const root = mountContainer();
    renderResourceList(root, ctx([FEATURE], FEATURE_USES, editState, {
      spellSlots: SLOT_STATE,
      derivedSpellSlots: DERIVED_SLOTS,
    }));
    return root;
  }

  it("renders the recover action inside the resource block (no separate button)", () => {
    const root = mount();
    expect(root.querySelector(".pc-resource-recover-btn")).toBeNull();   // old button gone
    const actions = root.querySelector(".pc-resource-actions");
    expect(actions).toBeTruthy();
    // one recover-row per expended level (L1, L3); L6 not expended/over-5 → excluded
    const lvls = Array.from(root.querySelectorAll(".pc-recover-pips")).map((p) => (p as HTMLElement).getAttribute("data-lv"));
    expect(lvls).toEqual(["1", "3"]);
    // one spent ✗ pip per expended slot: L1 has 2, L3 has 1 → 3 total
    expect(root.querySelectorAll(".pc-slot-pip--spent").length).toBe(3);
  });

  it("Recover starts disabled and stays disabled with no selection", () => {
    const root = mount();
    const apply = root.querySelector(".pc-recover-apply") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);
  });

  it("unticking expended pips within budget enables Recover and calls useRecovery with the picks", () => {
    const useRecovery = vi.fn();
    const root = mount({ useRecovery });
    const apply = root.querySelector(".pc-recover-apply") as HTMLButtonElement;
    // untick one L1 pip and the L3 pip → picks {1:1, 3:1}, spent levels = 1+3 = 4 == budget
    const l1pips = root.querySelector('.pc-recover-pips[data-lv="1"]')!;
    const l3pips = root.querySelector('.pc-recover-pips[data-lv="3"]')!;
    (l1pips.querySelector(".pc-slot-pip--spent") as HTMLElement).click();
    expect(apply.disabled).toBe(false);
    (l3pips.querySelector(".pc-slot-pip--spent") as HTMLElement).click();
    apply.click();
    expect(useRecovery).toHaveBeenCalledTimes(1);
    expect(useRecovery).toHaveBeenCalledWith("wizard:arcane-recovery", { 1: 1, 3: 1 });
  });

  it("over-budget pips are marked --over and not selectable", () => {
    const root = mount();
    // select the L3 pip first → spends 3 of the 4-level budget, 1 left
    const l3pip = root.querySelector('.pc-recover-pips[data-lv="3"] .pc-slot-pip--spent') as HTMLElement;
    l3pip.click();
    // remaining budget = 1; L1 pips (level 1) still fit (1 ≤ 1) so not over.
    // Now select an L1 pip → budget exhausted (0 left), the OTHER L1 pip becomes over.
    const l1pips = Array.from(root.querySelectorAll('.pc-recover-pips[data-lv="1"] .pc-slot-pip--spent')) as HTMLElement[];
    l1pips[0].click();
    const remainingL1 = root.querySelector('.pc-recover-pips[data-lv="1"] .pc-slot-pip--spent') as HTMLElement;
    expect(remainingL1.classList.contains("pc-slot-pip--over")).toBe(true);
    // clicking an over pip is a no-op
    remainingL1.click();
    expect(remainingL1.classList.contains("pc-slot-pip--sel")).toBe(false);
  });

  it("empty selection apply is a no-op (does not burn the use)", () => {
    const useRecovery = vi.fn();
    const root = mount({ useRecovery });
    const apply = root.querySelector(".pc-recover-apply") as HTMLButtonElement;
    apply.click();   // disabled / nothing selected
    expect(useRecovery).not.toHaveBeenCalled();
  });

  it("keeps the recover option visible when no slots are expended (hint, no picker)", () => {
    const root = mountContainer();
    renderResourceList(root, ctx([FEATURE], FEATURE_USES, null, {
      spellSlots: { 1: { used: 0, total: 4 }, 3: { used: 0, total: 3 } },   // nothing expended
      derivedSpellSlots: DERIVED_SLOTS,
    }));
    // the action area + header still render so the option is discoverable
    expect(root.querySelector(".pc-resource-actions")).toBeTruthy();
    expect(root.querySelector(".pc-recover-title")?.textContent).toBe("Recover spell slots");
    // but no interactive picker, and a hint explaining there is nothing to recover
    expect(root.querySelectorAll(".pc-slot-pip").length).toBe(0);
    expect(root.querySelector(".pc-recover-apply")).toBeNull();
    expect(root.querySelector(".pc-recover-hint")?.textContent).toContain("No expended spell slots");
  });

  it("when the recovery use is already spent, shows a spent hint and no interactive picker", () => {
    const root = mountContainer();
    renderResourceList(root, ctx([FEATURE], { "wizard:arcane-recovery": { used: 1, max: 1 } }, null, {
      spellSlots: SLOT_STATE,
      derivedSpellSlots: DERIVED_SLOTS,
    }));
    // the recover area + header still render
    const actions = root.querySelector(".pc-resource-actions");
    expect(actions).toBeTruthy();
    expect(root.querySelector(".pc-recover-title")?.textContent).toBe("Recover spell slots");
    // but NO interactive picker: no slot pips and no Recover button
    expect(root.querySelectorAll(".pc-slot-pip").length).toBe(0);
    expect(root.querySelector(".pc-recover-apply")).toBeNull();
    expect(root.querySelectorAll(".pc-recover-row").length).toBe(0);
    // a muted spent hint explaining when it recharges
    const hint = root.querySelector(".pc-recover-hint");
    expect(hint?.textContent).toContain("Already used");
    expect(hint?.textContent).toContain("Long Rest");
  });
});
