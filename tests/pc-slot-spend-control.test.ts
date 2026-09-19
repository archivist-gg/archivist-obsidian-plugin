/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderSlotSpendControl } from "../packages/obsidian/src/modules/pc/components/actions/slot-spend-control";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

describe("spell-slot spend control", () => {
  it("offers available slot levels and spends exactly the chosen level through the Spells writer", () => {
    const root = mountContainer();
    root.classList.add("archivist-pc-sheet");
    const expendSlot = vi.fn();
    const ctx = {
      resolved: { definition: { overrides: {} }, state: { spell_slots: { 1: { used: 1 }, 2: { used: 2 } } } },
      derived: { derivedSpellSlots: { 1: 4, 2: 2 } },
      editState: { expendSlot },
    } as unknown as ComponentRenderContext;
    expect(renderSlotSpendControl(root, ctx, "test-slot-row")).toBe(true);
    root.querySelector<HTMLButtonElement>(".pc-slot-picker-trigger")!.click();
    const rows = root.querySelectorAll<HTMLButtonElement>(".pc-slot-pop-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("3/4");
    expect(rows[1].disabled).toBe(true);
    expect(root.querySelector(".pc-slot-pop")?.textContent).not.toMatch(/Uses your reaction|Select one level|spent slot appears/i);
    rows[0].querySelector<HTMLElement>(".archivist-toggle-box:not(.archivist-toggle-box-checked)")!.click();
    expect(expendSlot).toHaveBeenCalledExactlyOnceWith(1);
    expect(root.querySelector(".pc-slot-pop")).not.toBeNull();
    expect(rows[0].textContent).toContain("2/4");
    expect(root.querySelector(".pc-slot-picker-trigger")?.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(root.querySelector(".pc-slot-pop")).toBeNull();
  });

  it("keeps the picker open with fresh counts after the slot writer re-renders the sheet", async () => {
    const root = mountContainer();
    root.classList.add("archivist-pc-sheet");
    const spellSlots = { 1: { used: 0 } };
    const editState = { expendSlot: vi.fn(() => {
      spellSlots[1].used += 1;
      root.replaceChildren();
      renderSlotSpendControl(root, ctx, "same-feature");
    }) };
    const ctx = {
      resolved: { definition: { overrides: {} }, state: { spell_slots: spellSlots } },
      derived: { derivedSpellSlots: { 1: 2 } },
      editState,
    } as unknown as ComponentRenderContext;
    renderSlotSpendControl(root, ctx, "same-feature");
    root.querySelector<HTMLButtonElement>(".pc-slot-picker-trigger")!.click();
    root.querySelector<HTMLButtonElement>(".pc-slot-pop-row")!.click();
    await Promise.resolve();
    expect(root.querySelector(".pc-slot-pop")?.textContent).toContain("1/2");
    expect(root.querySelector(".pc-slot-picker-trigger")?.getAttribute("aria-expanded")).toBe("true");
    root.querySelector<HTMLButtonElement>(".pc-slot-pop-row")!.click();
    await Promise.resolve();
    expect(root.querySelector(".pc-slot-pop")?.textContent).toContain("0/2");
    expect(root.querySelector<HTMLButtonElement>(".pc-slot-pop-row")?.disabled).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(root.querySelector(".pc-slot-pop")).toBeNull();
    root.replaceChildren();
    renderSlotSpendControl(root, ctx, "same-feature");
    await Promise.resolve();
    expect(root.querySelector(".pc-slot-pop")).toBeNull();
  });
});
