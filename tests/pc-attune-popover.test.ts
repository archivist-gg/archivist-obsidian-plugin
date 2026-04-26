/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { showAttunePopover } from "../src/modules/pc/components/inventory/attune-popover";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const occupant = (): ResolvedEquipped => ({
  index: 4,
  entry: { item: "[[ring-of-evasion]]", attuned: true },
  entity: {
    name: "Ring of Evasion", type: "ring", rarity: "rare",
    attunement: true,
    entries: ["This ring has 3 charges; spend one to succeed on a failed Dex save."],
  } as never,
  entityType: "item",
});

describe("showAttunePopover", () => {
  it("returns a popover element with item name + subtitle + description", () => {
    const root = mountContainer();
    const anchor = root.createDiv();
    showAttunePopover({
      anchor, occupant: occupant(),
      onUnattune: vi.fn(),
      onFindInList: vi.fn(),
    });
    const pop = document.body.querySelector(".pc-attune-popover");
    expect(pop?.querySelector(".pc-attune-pop-name")?.textContent).toBe("Ring of Evasion");
    expect(pop?.querySelector(".pc-attune-pop-subtitle")?.textContent).toMatch(/rare/i);
    expect(pop?.querySelector(".pc-attune-pop-desc")?.textContent).toMatch(/3 charges/i);
  });

  it("clicking Unattune calls onUnattune with the occupant index", () => {
    const root = mountContainer();
    const anchor = root.createDiv();
    const onUnattune = vi.fn();
    showAttunePopover({ anchor, occupant: occupant(), onUnattune, onFindInList: vi.fn() });
    const btn = document.body.querySelector(".pc-attune-pop-unattune") as HTMLElement;
    btn.click();
    expect(onUnattune).toHaveBeenCalledWith(4);
  });

  it("clicking Find in list calls onFindInList with the occupant index", () => {
    const root = mountContainer();
    const anchor = root.createDiv();
    const onFindInList = vi.fn();
    showAttunePopover({ anchor, occupant: occupant(), onUnattune: vi.fn(), onFindInList });
    const btn = document.body.querySelector(".pc-attune-pop-find") as HTMLElement;
    btn.click();
    expect(onFindInList).toHaveBeenCalledWith(4);
  });

  it("clicking outside closes the popover", () => {
    const root = mountContainer();
    const anchor = root.createDiv();
    showAttunePopover({ anchor, occupant: occupant(), onUnattune: vi.fn(), onFindInList: vi.fn() });
    expect(document.body.querySelector(".pc-attune-popover")).toBeTruthy();
    document.body.click();
    expect(document.body.querySelector(".pc-attune-popover")).toBeNull();
  });
});
