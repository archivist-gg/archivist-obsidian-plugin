/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { InventoryFilters } from "../src/modules/pc/components/inventory/inventory-filters";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { FilterState } from "../src/modules/pc/components/inventory/filter-state";

beforeAll(() => installObsidianDomHelpers());

const empty: FilterState = { status: "all", types: new Set(), rarities: new Set(), search: "" };

describe("InventoryFilters", () => {
  it("renders three labelled groups", () => {
    const root = mountContainer();
    new InventoryFilters({ filters: empty, mode: "list", onChange: vi.fn() }).render(root);
    const labels = [...root.querySelectorAll(".pc-inv-filter-group-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Status", "Type", "Rarity"]);
  });

  it("hides Status group in browse mode", () => {
    const root = mountContainer();
    new InventoryFilters({ filters: empty, mode: "browse", onChange: vi.fn() }).render(root);
    const labels = [...root.querySelectorAll(".pc-inv-filter-group-label")].map((l) => l.textContent);
    expect(labels).toEqual(["Type", "Rarity"]);
  });

  it("clicking a Status chip emits onChange with status set", () => {
    const onChange = vi.fn();
    const root = mountContainer();
    new InventoryFilters({ filters: empty, mode: "list", onChange }).render(root);
    const eq = [...root.querySelectorAll(".pc-inv-chip")].find((c) => c.textContent?.toLowerCase().includes("equipped")) as HTMLElement;
    eq.click();
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0] as FilterState;
    expect(next.status).toBe("equipped");
  });

  it("Type group is multi-select; clicking a chip toggles it on/off", () => {
    const onChange = vi.fn();
    const filters: FilterState = { ...empty, types: new Set(["weapon"]) };
    const root = mountContainer();
    new InventoryFilters({ filters, mode: "list", onChange }).render(root);
    const armor = [...root.querySelectorAll(".pc-inv-chip")].find((c) => c.textContent?.toLowerCase().includes("armor")) as HTMLElement;
    armor.click();
    const next = onChange.mock.calls[0][0] as FilterState;
    expect(next.types.has("weapon")).toBe(true);
    expect(next.types.has("armor")).toBe(true);
  });

  it("clicking 'All' Status clears other Status selections", () => {
    const onChange = vi.fn();
    const filters: FilterState = { ...empty, status: "equipped" };
    const root = mountContainer();
    new InventoryFilters({ filters, mode: "list", onChange }).render(root);
    const all = [...root.querySelectorAll(".pc-inv-chip")].find((c) => c.textContent?.toLowerCase().includes("all")) as HTMLElement;
    all.click();
    const next = onChange.mock.calls[0][0] as FilterState;
    expect(next.status).toBe("all");
  });

  it("active chips carry .active class", () => {
    const filters: FilterState = { ...empty, status: "attuned", types: new Set(["weapon"]), rarities: new Set(["rare"]) };
    const root = mountContainer();
    new InventoryFilters({ filters, mode: "list", onChange: vi.fn() }).render(root);
    const active = [...root.querySelectorAll(".pc-inv-chip.active")].map((c) => c.textContent?.toLowerCase().trim());
    expect(active.some((t) => t?.includes("attuned"))).toBe(true);
    expect(active.some((t) => t?.includes("weapon"))).toBe(true);
    expect(active.some((t) => t?.includes("rare"))).toBe(true);
  });
});
