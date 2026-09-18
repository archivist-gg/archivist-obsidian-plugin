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
    expect(renderSlotSpendControl(root, ctx)).toBe(true);
    root.querySelector<HTMLButtonElement>(".pc-slot-picker-trigger")!.click();
    const rows = root.querySelectorAll<HTMLButtonElement>(".pc-slot-pop-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("3/4");
    expect(rows[1].disabled).toBe(true);
    expect(root.querySelector(".pc-slot-pop")?.textContent).not.toMatch(/Uses your reaction|Select one level|spent slot appears/i);
    rows[0].click();
    expect(expendSlot).toHaveBeenCalledExactlyOnceWith(1);
    expect(root.querySelector(".pc-slot-pop")).toBeNull();
  });
});
