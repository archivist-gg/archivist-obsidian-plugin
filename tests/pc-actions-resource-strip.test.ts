/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderResourceStrip } from "../src/modules/pc/components/actions/resource-badge";
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

describe("renderResourceStrip", () => {
  it("renders a pip badge for a non-action pool", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Rage", resources: [{ id: "barbarian:rage", name: "Rage", max_formula: "3", reset: "long-rest" }] }, source: { kind: "class", slug: "barbarian", level: 1 } }],
      { "barbarian:rage": { used: 1, max: 3 } },
    ));
    expect(root.querySelectorAll(".pc-resource-badge").length).toBe(1);
    expect(root.textContent).toContain("Rage");
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(3);
    expect(root.querySelectorAll(".archivist-toggle-box-checked").length).toBe(1);
  });

  it("renders a counter for a large pool (max > 6)", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sorcerer:sorcery-points", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sorcerer:sorcery-points": { used: 3, max: 9 } },
    ));
    expect(root.querySelectorAll(".pc-resource-counter").length).toBe(1);
    expect(root.querySelectorAll(".archivist-toggle-box").length).toBe(0);
    expect(root.textContent).toContain("9");
  });

  it("omits an actionable feature's first resource (shown in the table) but keeps extras", () => {
    const root = mountContainer();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Second Wind", action: "bonus-action", resources: [{ id: "fighter:second-wind", name: "Second Wind", max_formula: "1", reset: "short-rest" }] }, source: { kind: "class", slug: "fighter", level: 1 } }],
      { "fighter:second-wind": { used: 0, max: 1 } },
    ));
    expect(root.querySelectorAll(".pc-resource-badge").length).toBe(0);   // no strip, no heading
    expect(root.textContent).not.toContain("Resources");
  });

  it("counter shows remaining and the −/+ steppers spend/restore via setFeatureUse", () => {
    const root = mountContainer();
    const setFeatureUse = vi.fn();
    renderResourceStrip(root, ctx(
      [{ feature: { name: "Sorcery Points", resources: [{ id: "sp", name: "Sorcery Points", max_formula: "9", reset: "long-rest" }] }, source: { kind: "class", slug: "sorcerer", level: 1 } }],
      { "sp": { used: 3, max: 9 } },                                   // used=3 → remaining 6/9
      { setFeatureUse },
    ));
    expect(root.querySelector(".pc-resource-counter-val")?.textContent).toBe("6/9");
    (root.querySelector(".pc-resource-step-minus") as HTMLElement).click();   // spend → used 3→4
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 4);
    (root.querySelector(".pc-resource-step-plus") as HTMLElement).click();    // restore → used 3→2
    expect(setFeatureUse).toHaveBeenCalledWith("sp", 2);
  });
});

describe("renderResourceStrip — recovery picker", () => {
  // Arcane Recovery: non-actionable pool, used 0 < max 1, recovery amount "4".
  // Derived slots at L1/L3/L6; expended slot state: L1=2, L3=1, L6 none.
  const FEATURE = {
    feature: {
      name: "Arcane Recovery",
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
    renderResourceStrip(root, ctx([FEATURE], FEATURE_USES, editState, {
      spellSlots: SLOT_STATE,
      derivedSpellSlots: DERIVED_SLOTS,
    }));
    return root;
  }

  // Resolve the dec/inc/val for a given picker level row by its "L{lvl}" label.
  function row(picker: Element, lvl: number) {
    const rows = Array.from(picker.querySelectorAll(".pc-resource-picker-row"));
    const r = rows.find((el) => el.querySelector("span")?.textContent === `L${lvl}`);
    if (!r) throw new Error(`no picker row for L${lvl}`);
    const btns = Array.from(r.querySelectorAll("button"));
    return {
      dec: btns[0] as HTMLButtonElement,
      inc: btns[1] as HTMLButtonElement,
      val: r.querySelector(".pc-resource-picker-val") as HTMLElement,
    };
  }

  it("renders an enabled Recover button for the non-actionable pool", () => {
    const root = mount();
    const btn = root.querySelector(".pc-resource-recover-btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe("Recover slots");
    expect(btn.disabled).toBe(false);   // used 0 < max 1
  });

  it("opens exactly one picker, and re-clicking does not duplicate it", () => {
    const root = mount();
    const btn = root.querySelector(".pc-resource-recover-btn") as HTMLButtonElement;
    btn.click();
    expect(root.querySelectorAll(".pc-resource-picker").length).toBe(1);
    btn.click();
    expect(root.querySelectorAll(".pc-resource-picker").length).toBe(1);
  });

  it("renders rows only for derived levels ≤5 (L1, L3 — not L6)", () => {
    const root = mount();
    (root.querySelector(".pc-resource-recover-btn") as HTMLElement).click();
    const picker = root.querySelector(".pc-resource-picker")!;
    const labels = Array.from(picker.querySelectorAll(".pc-resource-picker-row"))
      .map((r) => r.querySelector("span")?.textContent);   // first span = the L{lvl} label
    expect(labels).toEqual(["L1", "L3"]);   // L6 excluded by the ≤5 filter
  });

  it("caps a level's picks to the currently-expended slot count", () => {
    const root = mount();
    (root.querySelector(".pc-resource-recover-btn") as HTMLElement).click();
    const picker = root.querySelector(".pc-resource-picker")!;
    const l3 = row(picker, 3);
    l3.inc.click();                              // 1 ≤ expended(3) and 3 ≤ budget(4) → allowed
    expect(l3.val.textContent).toBe("1");

    // fresh picker for the L1 cap (re-open clears picks)
    const root2 = mount();
    (root2.querySelector(".pc-resource-recover-btn") as HTMLElement).click();
    const l1 = row(root2.querySelector(".pc-resource-picker")!, 1);
    l1.inc.click(); l1.inc.click(); l1.inc.click();   // expended=2 → 3rd click rejected
    expect(l1.val.textContent).toBe("2");
  });

  it("enforces the budget boundary: ==amount allowed, >amount rejected", () => {
    const root = mount();
    (root.querySelector(".pc-resource-recover-btn") as HTMLElement).click();
    const picker = root.querySelector(".pc-resource-picker")!;
    const l3 = row(picker, 3);
    const l1 = row(picker, 1);
    l3.inc.click();                  // spent 3
    expect(l3.val.textContent).toBe("1");
    l1.inc.click();                  // spent 3+1=4 == amount → allowed
    expect(l1.val.textContent).toBe("1");
    l1.inc.click();                  // spent would be 5 > amount → rejected
    expect(l1.val.textContent).toBe("1");
  });

  it("does not burn the recovery use on an empty apply, but does once a pick is made", () => {
    const useRecovery = vi.fn();
    const root = mount({ useRecovery });
    (root.querySelector(".pc-resource-recover-btn") as HTMLElement).click();
    const picker = root.querySelector(".pc-resource-picker")!;

    (picker.querySelector(".pc-resource-picker-apply") as HTMLElement).click();   // no picks
    expect(useRecovery).not.toHaveBeenCalled();
    expect(root.querySelectorAll(".pc-resource-picker").length).toBe(1);          // stays open

    row(picker, 1).inc.click();                                                   // one valid pick
    (picker.querySelector(".pc-resource-picker-apply") as HTMLElement).click();
    expect(useRecovery).toHaveBeenCalledTimes(1);
    expect(useRecovery).toHaveBeenCalledWith("wizard:arcane-recovery", { 1: 1 });
  });
});
