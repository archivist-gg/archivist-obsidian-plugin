/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderInlineItemForm } from "../src/modules/pc/components/inventory/inline-item-form";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { EquipmentEntry } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

describe("renderInlineItemForm", () => {
  it("renders Name / Qty / Weight / Notes fields populated from entry", () => {
    const entry: EquipmentEntry = { item: "50 ft of hempen rope", qty: 1, notes: "for climbing" } as EquipmentEntry;
    const root = mountContainer();
    renderInlineItemForm(root, { entry, index: 0, onChange: vi.fn() });
    const fields = [...root.querySelectorAll(".pc-inv-inline-field")];
    expect(fields.length).toBeGreaterThanOrEqual(4);
    expect(root.querySelector(".pc-inv-inline-field-name")?.textContent).toContain("50 ft of hempen rope");
  });

  it("clicking Name calls onChange with the new name", () => {
    const entry: EquipmentEntry = { item: "rope" } as EquipmentEntry;
    const onChange = vi.fn();
    const root = mountContainer();
    renderInlineItemForm(root, { entry, index: 0, onChange });
    const nameVal = root.querySelector(".pc-inv-inline-field-name .pc-inv-inline-val") as HTMLElement;
    nameVal.click();
    const input = root.querySelector("input[type='text']") as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "50 ft of rope";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ item: "50 ft of rope" });
  });

  it("renders 'No compendium entry' help text + Promote link", () => {
    const root = mountContainer();
    renderInlineItemForm(root, { entry: { item: "rope" } as EquipmentEntry, index: 0, onChange: vi.fn() });
    expect(root.querySelector(".pc-inv-inline-help")?.textContent).toMatch(/no compendium entry/i);
    expect(root.querySelector(".pc-inv-inline-promote")).toBeTruthy();
  });
});
