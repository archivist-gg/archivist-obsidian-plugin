/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

// The default obsidian mock exports `class Modal {}` (empty) and `setIcon`
// as a no-op. The conflict modal needs a `contentEl` (used by `onOpen`),
// a `close()` method (called when a swap-cell or Cancel is clicked), and
// a `setIcon` that injects an <svg> so cells render visibly.
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

import { AttuneConflictModal } from "../src/modules/pc/components/inventory/attune-conflict-modal";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { App } from "obsidian";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const r = (name: string, index: number, rarity = "rare"): ResolvedEquipped => ({
  index,
  entry: { item: `[[${name.toLowerCase()}]]`, attuned: true },
  entity: { name, type: "ring", rarity, attunement: true } as never,
  entityType: "item",
});

describe("AttuneConflictModal", () => {
  it("renders three swap-cells for the currently-attuned items + an incoming cell", () => {
    const slots = [r("Ring A", 1), r("Ring B", 2), r("Ring C", 3)];
    const incoming = r("Ring D", 7, "legendary");
    const m = new AttuneConflictModal({} as App, { slots, incoming, onSwap: vi.fn() });
    m.onOpen();
    const card = m.contentEl;
    const cells = card.querySelectorAll(".pc-attune-conflict-cell");
    expect(cells.length).toBe(4); // 3 existing + 1 incoming
    expect([...cells].some((c) => c.classList.contains("incoming"))).toBe(true);
  });

  it("clicking a swap-cell calls onSwap with that slot's occupant index", () => {
    const slots = [r("Ring A", 1), r("Ring B", 2), r("Ring C", 3)];
    const incoming = r("Ring D", 7);
    const onSwap = vi.fn();
    const m = new AttuneConflictModal({} as App, { slots, incoming, onSwap });
    m.onOpen();
    const swappable = [...m.contentEl.querySelectorAll(".pc-attune-conflict-cell:not(.incoming)")] as HTMLElement[];
    swappable[1].click();
    expect(onSwap).toHaveBeenCalledWith(2); // Ring B's index
  });

  it("Cancel button does NOT call onSwap", () => {
    const slots = [r("Ring A", 1), r("Ring B", 2), r("Ring C", 3)];
    const incoming = r("Ring D", 7);
    const onSwap = vi.fn();
    const m = new AttuneConflictModal({} as App, { slots, incoming, onSwap });
    m.onOpen();
    (m.contentEl.querySelector(".pc-attune-conflict-cancel") as HTMLElement).click();
    expect(onSwap).not.toHaveBeenCalled();
  });
});
