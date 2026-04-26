/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { InventoryToolbar } from "../src/modules/pc/components/inventory/inventory-toolbar";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("InventoryToolbar", () => {
  it("renders search input and Add Item button by default", () => {
    const root = mountContainer();
    new InventoryToolbar({ mode: "list", onSearch: vi.fn(), onAdd: vi.fn(), onDone: vi.fn() }).render(root);
    expect(root.querySelector(".pc-inv-search input")).toBeTruthy();
    expect(root.querySelector(".pc-inv-add")?.textContent).toMatch(/add/i);
    expect(root.querySelector(".pc-inv-done")).toBeNull();
  });

  it("typing in search calls onSearch with the value", () => {
    const onSearch = vi.fn();
    const root = mountContainer();
    new InventoryToolbar({ mode: "list", onSearch, onAdd: vi.fn(), onDone: vi.fn() }).render(root);
    const input = root.querySelector(".pc-inv-search input") as HTMLInputElement;
    input.value = "ring";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onSearch).toHaveBeenCalledWith("ring");
  });

  it("clicking Add Item calls onAdd", () => {
    const onAdd = vi.fn();
    const root = mountContainer();
    new InventoryToolbar({ mode: "list", onSearch: vi.fn(), onAdd, onDone: vi.fn() }).render(root);
    (root.querySelector(".pc-inv-add") as HTMLElement).click();
    expect(onAdd).toHaveBeenCalled();
  });

  it("in browse mode shows Done instead of Add Item", () => {
    const onDone = vi.fn();
    const root = mountContainer();
    new InventoryToolbar({ mode: "browse", onSearch: vi.fn(), onAdd: vi.fn(), onDone }).render(root);
    expect(root.querySelector(".pc-inv-add")).toBeNull();
    const done = root.querySelector(".pc-inv-done") as HTMLElement;
    expect(done).toBeTruthy();
    done.click();
    expect(onDone).toHaveBeenCalled();
  });
});
