/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderSideButtons } from "../packages/obsidian/src/shared/edit/side-buttons";
import type { SideButtonConfig } from "../packages/obsidian/src/shared/edit/side-buttons";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

const cfg = (over: Partial<SideButtonConfig>): SideButtonConfig => ({
  state: "default", onEdit: () => {}, onSave: () => {}, onSaveAsNew: () => {}, onCompendium: () => {}, onCancel: () => {},
  onDelete: () => {}, onColumnToggle: () => {}, isColumnActive: false, showColumnToggle: false, ...over,
});

describe("renderSideButtons on a readonly host (R4-G6b §3.2)", () => {
  it("default + isHostReadonly hides Delete and keeps Edit", () => {
    const el = mountContainer(); renderSideButtons(el, cfg({ isHostReadonly: true }));
    expect(el.querySelector('[aria-label="Delete"]')).toBeNull();
    expect(el.querySelector('[aria-label="Edit"]')).not.toBeNull();
  });

  it("pending + isHostReadonly renders exactly Save-as-new and Cancel", () => {
    const el = mountContainer(); const onSaveAsNew = vi.fn(); const onCancel = vi.fn();
    renderSideButtons(el, cfg({ state: "pending", isHostReadonly: true, onSaveAsNew, onCancel }));
    expect(Array.from(el.querySelectorAll(".archivist-side-btn")).length).toBe(2);
    expect(el.querySelector(".archivist-side-btn-save-as-new")).not.toBeNull();
    expect(el.querySelector(".archivist-side-btn-cancel")).not.toBeNull();
    expect(el.querySelector(".archivist-side-btn-save")).toBeNull();
    expect(el.querySelector(".archivist-side-btn-compendium")).toBeNull();
    (el.querySelector(".archivist-side-btn-save-as-new") as HTMLElement).click(); expect(onSaveAsNew).toHaveBeenCalledTimes(1);
    (el.querySelector(".archivist-side-btn-cancel") as HTMLElement).click(); expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("without the flag every state renders today's buttons (the control)", () => {
    const d = mountContainer(); renderSideButtons(d, cfg({})); expect(d.querySelector('[aria-label="Delete"]')).not.toBeNull();
    const p = mountContainer(); renderSideButtons(p, cfg({ state: "pending" }));
    expect(p.querySelector(".archivist-side-btn-save")).not.toBeNull(); expect(p.querySelector(".archivist-side-btn-compendium")).not.toBeNull();
    expect(p.querySelector(".archivist-side-btn-save-as-new")).toBeNull();
  });
});
