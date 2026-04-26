/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";

// Inject an <svg> child when setIcon is called so tests can assert icon presence.
// The default obsidian mock has setIcon as a no-op, which would leave the
// `.pc-medallion-icon` span empty.
vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    setIcon: (el: HTMLElement, name: string) => {
      el.setAttribute("data-icon", name);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.appendChild(svg);
    },
  };
});

import { renderMedallion } from "../src/modules/pc/components/inventory/attune-medallion";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

describe("renderMedallion", () => {
  it("renders an empty slot with dashed border + plus icon when occupant is null", () => {
    const root = mountContainer();
    renderMedallion(root, { slotIndex: 0, occupant: null, onClickEmpty: vi.fn(), onClickFilled: vi.fn() });
    const m = root.querySelector(".pc-medallion");
    expect(m?.classList.contains("empty")).toBe(true);
    expect(m?.querySelector("svg")).toBeTruthy();
  });

  it("renders a filled slot with rarity-tinted border and item icon", () => {
    const occupant: ResolvedEquipped = {
      index: 4,
      entry: { item: "[[ring-of-evasion]]", attuned: true },
      entity: { name: "Ring of Evasion", type: "ring", rarity: "rare" } as never,
      entityType: "item",
    };
    const root = mountContainer();
    renderMedallion(root, { slotIndex: 0, occupant, onClickEmpty: vi.fn(), onClickFilled: vi.fn() });
    const m = root.querySelector(".pc-medallion");
    expect(m?.classList.contains("empty")).toBe(false);
    expect(m?.classList.contains("rarity-rare")).toBe(true);
  });

  it("filled medallion renders item name below", () => {
    const occupant: ResolvedEquipped = {
      index: 4,
      entry: { item: "[[ring-of-evasion]]", attuned: true },
      entity: { name: "Ring of Evasion", type: "ring", rarity: "rare" } as never,
      entityType: "item",
    };
    const root = mountContainer();
    renderMedallion(root, { slotIndex: 0, occupant, onClickEmpty: vi.fn(), onClickFilled: vi.fn() });
    expect(root.querySelector(".pc-medallion-name")?.textContent).toBe("Ring of Evasion");
  });

  it("clicking an empty medallion calls onClickEmpty with slotIndex", () => {
    const onClickEmpty = vi.fn();
    const root = mountContainer();
    renderMedallion(root, { slotIndex: 2, occupant: null, onClickEmpty, onClickFilled: vi.fn() });
    (root.querySelector(".pc-medallion") as HTMLElement).click();
    expect(onClickEmpty).toHaveBeenCalledWith(2);
  });

  it("clicking a filled medallion calls onClickFilled with the occupant", () => {
    const occupant: ResolvedEquipped = {
      index: 4, entry: { item: "[[ring]]", attuned: true },
      entity: { name: "Ring", type: "ring" } as never,
      entityType: "item",
    };
    const onClickFilled = vi.fn();
    const root = mountContainer();
    renderMedallion(root, { slotIndex: 0, occupant, onClickEmpty: vi.fn(), onClickFilled });
    (root.querySelector(".pc-medallion") as HTMLElement).click();
    expect(onClickFilled).toHaveBeenCalledWith(occupant, expect.any(Object));
  });
});
