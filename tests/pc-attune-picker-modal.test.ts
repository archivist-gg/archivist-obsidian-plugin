/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

// The default obsidian mock exports `class Modal {}` (empty) and `setIcon`
// as a no-op. The picker modal needs a `contentEl` (used by `onOpen`),
// a `close()` method (called when Pick / Cancel is clicked), and a
// `setIcon` that injects an <svg> so rows render visibly.
vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    setIcon: (el: HTMLElement, name: string) => {
      el.setAttribute("data-icon", name);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.appendChild(svg);
    },
    Modal: class {
      app: unknown;
      contentEl: HTMLElement;
      constructor(app: unknown) {
        this.app = app;
        this.contentEl = document.createElement("div");
      }
      open(): void {}
      close(): void {}
      onOpen(): void {}
      onClose(): void {}
    },
  };
});

import { AttunePickerModal } from "../src/modules/pc/components/inventory/attune-picker-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { App } from "obsidian";
import type { VisibleEntry } from "../src/modules/pc/components/inventory/filter-state";

beforeAll(() => installObsidianDomHelpers());

const candidate = (name: string, index: number, attunement: unknown = true): VisibleEntry => ({
  entry: { item: `[[${name.toLowerCase().replace(/ /g, "-")}]]` },
  resolved: {
    index,
    entry: { item: `[[${name.toLowerCase().replace(/ /g, "-")}]]` },
    entity: { name, type: "ring", attunement } as never,
    entityType: "item",
  },
});

describe("AttunePickerModal", () => {
  it("renders one row per candidate", () => {
    const candidates = [candidate("Ring of X", 1), candidate("Bracers", 2)];
    const m = new AttunePickerModal({} as App, { slotIndex: 2, candidates, onPick: vi.fn() });
    m.onOpen();
    expect(m.contentEl.querySelectorAll(".pc-attune-picker-row")).toHaveLength(2);
  });

  it("renders an empty-state message when there are no candidates", () => {
    const m = new AttunePickerModal({} as App, { slotIndex: 2, candidates: [], onPick: vi.fn() });
    m.onOpen();
    expect(m.contentEl.querySelector(".pc-attune-picker-empty")).toBeTruthy();
  });

  it("clicking Pick calls onPick with the candidate's index", () => {
    const onPick = vi.fn();
    const candidates = [candidate("Ring of X", 1), candidate("Bracers", 2)];
    const m = new AttunePickerModal({} as App, { slotIndex: 0, candidates, onPick });
    m.onOpen();
    const picks = [...m.contentEl.querySelectorAll(".pc-attune-picker-pick")] as HTMLElement[];
    picks[1].click();
    expect(onPick).toHaveBeenCalledWith(2);
  });
});
