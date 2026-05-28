/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderOverrideActionsPanel } from "../src/modules/pc/components/inventory/override-actions-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { EquipmentEntry } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

describe("OverrideActionsPanel", () => {
  it("renders form fields for action / range / max_charges / recovery", () => {
    const root = mountContainer();
    const entry = { item: "[[wand-of-fireballs]]", overrides: { action: "action", range: "150 ft." }, state: { charges: { current: 5, max: 7 }, recovery: { amount: "1d6+1", reset: "dawn" } } } as EquipmentEntry;
    renderOverrideActionsPanel(root, { entry, entryIndex: 0, editState: {} as never });
    expect(root.querySelector("select[data-field='action']")).toBeTruthy();
    expect(root.querySelector("input[data-field='range']")).toBeTruthy();
    expect(root.querySelector("input[data-field='max_charges']")).toBeTruthy();
    expect((root.querySelector("input[data-field='range']") as HTMLInputElement).value).toBe("150 ft.");
  });

  it("changing action select calls editState.setEquipmentOverride", () => {
    const root = mountContainer();
    const setEquipmentOverride = vi.fn();
    const entry = { item: "[[w]]" } as EquipmentEntry;
    renderOverrideActionsPanel(root, { entry, entryIndex: 0, editState: { setEquipmentOverride } as never });
    const sel = root.querySelector("select[data-field='action']") as HTMLSelectElement;
    sel.value = "bonus-action";
    sel.dispatchEvent(new Event("change"));
    expect(setEquipmentOverride).toHaveBeenCalledWith(0, expect.objectContaining({ action: "bonus-action" }));
  });
});
