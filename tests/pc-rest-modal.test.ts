/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock Obsidian's Modal with a minimal real class
vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    Modal: class {
      app: unknown;
      contentEl: HTMLElement;
      constructor(app: unknown) {
        this.app = app;
        this.contentEl = document.createElement("div");
      }
      open(): void { this.onOpen?.(); }
      close(): void { this.onClose?.(); }
      onOpen?(): void {}
      onClose?(): void {}
    },
  };
});

import { RestModal } from "../src/modules/pc/components/rest-modal";
import { CharacterEditState } from "../src/modules/pc/pc.edit-state";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import {
  WIZARD_5_WOUNDED, BARBARIAN_6_EXHAUSTED, MONK_6_DRAINED, PC_WITH_MAGIC_ITEMS,
  clone, fakeResolved, fakeDerived,
} from "./fixtures/pc/rest-fixtures";
import type { App } from "obsidian";

beforeAll(() => installObsidianDomHelpers());

function makeModal(type: "short" | "long", character = clone(WIZARD_5_WOUNDED), features: unknown[] = []) {
  const resolved = fakeResolved(character, { features: features as never });
  const derived = fakeDerived(character);
  const onChange = vi.fn();
  const es = new CharacterEditState(character, () => ({ resolved, derived }), onChange);
  const m = new RestModal({} as App, es, resolved, derived, type);
  m.onOpen();
  return { m, es, character, onChange };
}

describe("RestModal — long rest", () => {
  it("renders title and an opt-out row per plan category", () => {
    const { m } = makeModal("long");
    expect(m.contentEl.querySelector(".pc-rest-modal-title")?.textContent).toContain("Long Rest");
    expect(m.contentEl.querySelectorAll(".pc-rest-opt-row").length).toBeGreaterThan(0);
  });

  it("Confirm applies the rest and closes", () => {
    const { m, character, onChange } = makeModal("long");
    const confirm = m.contentEl.querySelector(".pc-rest-btn-confirm") as HTMLButtonElement;
    confirm.click();
    expect(character.state.hp.current).toBe(32);
    expect(onChange).toHaveBeenCalled();
  });

  it("toggling a checkbox toggles opt-out and visual class", () => {
    const { m, character } = makeModal("long");
    const row = m.contentEl.querySelector(".pc-rest-opt-row") as HTMLLIElement;
    const checkbox = row.querySelector(".pc-rest-opt-checkbox") as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));
    expect(row.classList.contains("opt-out")).toBe(true);
    // Confirm now skips that category (verifying integration with editState)
    (m.contentEl.querySelector(".pc-rest-btn-confirm") as HTMLButtonElement).click();
    // First category in wizard's plan is HP, so HP should NOT have been healed
    expect(character.state.hp.current).toBe(12);
  });

  it("Cancel closes without applying", () => {
    const { m, character, onChange } = makeModal("long");
    const cancel = m.contentEl.querySelector(".pc-rest-btn-ghost") as HTMLButtonElement;
    cancel.click();
    expect(character.state.hp.current).toBe(12);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the empty-state message when nothing to rest", () => {
    const c = clone(WIZARD_5_WOUNDED);
    c.state.hp.current = c.state.hp.max;
    c.state.spell_slots = { 1: { used: 0, total: 4 } };
    c.state.hit_dice = { d6: { used: 0, total: 5 } };
    c.state.exhaustion = 0;
    c.state.concentration = null;
    c.equipment = [];
    c.state.feature_uses = {};
    const { m } = makeModal("long", c);
    expect(m.contentEl.querySelector(".pc-rest-modal-empty")).toBeTruthy();
  });
});

describe("RestModal — short rest — HD pips", () => {
  it("renders one pip per die in each pool", () => {
    const { m } = makeModal("short", clone(MONK_6_DRAINED)); // d10 pool 5 dice (one full pool)
    const pips = m.contentEl.querySelectorAll(".pc-rest-pip-row .pc-rest-pip");
    expect(pips.length).toBeGreaterThan(0);
  });

  it("clicking an empty pip selects up to and including it", () => {
    const { m } = makeModal("short", clone(MONK_6_DRAINED));
    const pips = Array.from(m.contentEl.querySelectorAll(".pc-rest-pip-row:first-child .pc-rest-pip"));
    const target = pips.find((p) => !(p.classList.contains("spent"))) as HTMLDivElement;
    target.click();
    expect(m.contentEl.querySelectorAll(".pc-rest-pip.selected").length).toBeGreaterThan(0);
  });
});

describe("RestModal — short rest — Roll & Apply / Apply Avg", () => {
  it("Apply Avg commits a deterministic heal per selected pip", () => {
    const c = clone(MONK_6_DRAINED);
    c.state.hp.current = 10; // wounded so heal doesn't cap immediately
    c.state.hp.max = 100;
    c.abilities.con = 14; // con mod +2
    const { m, character } = makeModal("short", c);
    // Select 1 d10 pip
    const pip = m.contentEl.querySelector(".pc-rest-pip:not(.spent)") as HTMLDivElement;
    pip.click();
    // Apply Avg — d10 avg is 6, + con 2 = +8
    const avgBtn = Array.from(m.contentEl.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Apply Avg")) as HTMLButtonElement;
    avgBtn.click();
    expect(character.state.hp.current).toBe(18); // 10 + 8
  });

  it("Roll & Apply calls spendHitDie and heal once per pip", () => {
    const c = clone(MONK_6_DRAINED);
    c.state.hp.current = 10;
    c.state.hp.max = 100;
    const { m, es } = makeModal("short", c);
    const spendSpy = vi.spyOn(es, "spendHitDie");
    const healSpy = vi.spyOn(es, "heal");
    // Select 2 d10 pips (filter out spent ones — MONK_6_DRAINED has 3 d10 spent)
    const empty = m.contentEl.querySelectorAll(".pc-rest-pip-row:first-child .pc-rest-pip:not(.spent)");
    (empty[0] as HTMLDivElement).click();
    // After the first click the modal re-renders; re-query the second empty pip.
    const empty2 = m.contentEl.querySelectorAll(".pc-rest-pip-row:first-child .pc-rest-pip:not(.spent):not(.selected)");
    (empty2[0] as HTMLDivElement).click();
    // Click the HD strip's Roll & Apply button (class pc-rest-btn-roll —
    // distinct from the footer's pc-rest-btn-confirm so test selectors don't collide)
    (m.contentEl.querySelector(".pc-rest-btn-roll") as HTMLButtonElement).click();
    expect(spendSpy).toHaveBeenCalledTimes(2);
    expect(healSpy).toHaveBeenCalledTimes(2);
  });
});

describe("RestModal — short rest — Manual entry", () => {
  it("tapping ✎ Manual reveals an inline input", () => {
    const c = clone(MONK_6_DRAINED);
    const { m } = makeModal("short", c);
    // Select a pip first
    (m.contentEl.querySelector(".pc-rest-pip:not(.spent)") as HTMLDivElement).click();
    expect(m.contentEl.querySelector(".pc-rest-manual-input")).toBeNull();
    const manualBtn = Array.from(m.contentEl.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Manual")) as HTMLButtonElement;
    manualBtn.click();
    expect(m.contentEl.querySelector(".pc-rest-manual-input")).toBeTruthy();
  });

  it("Apply commits the typed value plus CON mod", () => {
    const c = clone(MONK_6_DRAINED);
    c.state.hp.current = 10;
    c.state.hp.max = 100;
    c.abilities.con = 12; // +1
    const { m, character } = makeModal("short", c);
    (m.contentEl.querySelector(".pc-rest-pip:not(.spent)") as HTMLDivElement).click();
    const manualBtn = Array.from(m.contentEl.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Manual")) as HTMLButtonElement;
    manualBtn.click();
    const input = m.contentEl.querySelector(".pc-rest-manual-number") as HTMLInputElement;
    input.value = "5";
    const apply = m.contentEl.querySelector(".pc-rest-btn-roll--small") as HTMLButtonElement;
    apply.click();
    expect(character.state.hp.current).toBe(16); // 10 + 5 (value) + 1 (con)
  });

  it("Escape collapses the manual input", () => {
    const c = clone(MONK_6_DRAINED);
    const { m } = makeModal("short", c);
    (m.contentEl.querySelector(".pc-rest-pip:not(.spent)") as HTMLDivElement).click();
    (Array.from(m.contentEl.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Manual")) as HTMLButtonElement).click();
    const input = m.contentEl.querySelector(".pc-rest-manual-number") as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(m.contentEl.querySelector(".pc-rest-manual-input")).toBeNull();
  });
});

describe("RestModal — short rest — Confirm", () => {
  it("Confirm calls editState.shortRest with current optouts", () => {
    const c = clone(MONK_6_DRAINED);
    const ki = [{ feature: { id: "ki", name: "Ki", resources: [{ id: "ki", reset: "short-rest" }] }, source: null }];
    const { m, character } = makeModal("short", c, ki);
    (m.contentEl.querySelector(".pc-rest-modal-footer .pc-rest-btn-confirm") as HTMLButtonElement).click();
    expect(character.state.feature_uses.ki.used).toBe(0);
  });

  it("HD already spent during modal remain spent after Cancel", () => {
    const c = clone(MONK_6_DRAINED);
    c.state.hp.current = 10;
    c.state.hp.max = 100;
    const { m, character } = makeModal("short", c);
    // Spend 1 HD via Apply Avg
    (m.contentEl.querySelector(".pc-rest-pip:not(.spent)") as HTMLDivElement).click();
    (Array.from(m.contentEl.querySelectorAll("button"))
      .find((b) => b.textContent?.includes("Apply Avg")) as HTMLButtonElement).click();
    const usedAfterSpend = character.state.hit_dice.d10.used;
    expect(usedAfterSpend).toBeGreaterThan(0);
    // Cancel
    (m.contentEl.querySelector(".pc-rest-modal-footer .pc-rest-btn-ghost") as HTMLButtonElement).click();
    expect(character.state.hit_dice.d10.used).toBe(usedAfterSpend); // not rolled back
  });

  it("Short rest restores magic-item charges with reset='short' only", () => {
    const c = clone(PC_WITH_MAGIC_ITEMS);
    const { m, character } = makeModal("short", c);
    (m.contentEl.querySelector(".pc-rest-modal-footer .pc-rest-btn-confirm") as HTMLButtonElement).click();
    expect(character.equipment[0].state!.charges!.current).toBe(3); // bag-of-tricks: short ✓
    expect(character.equipment[1].state!.charges!.current).toBe(0); // cloak: dawn (skipped on short)
  });
});
