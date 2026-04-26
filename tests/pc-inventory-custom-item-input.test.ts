/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderCustomItemInput } from "../src/modules/pc/components/inventory/custom-item-input";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderCustomItemInput", () => {
  it("renders a labelled dashed input row", () => {
    const root = mountContainer();
    renderCustomItemInput(root, { onAdd: vi.fn() });
    expect(root.querySelector(".pc-inv-custom-input")).toBeTruthy();
    expect(root.querySelector(".pc-inv-custom-input input")).toBeTruthy();
  });

  it("clicking Add with non-empty input calls onAdd with the trimmed string", () => {
    const onAdd = vi.fn();
    const root = mountContainer();
    renderCustomItemInput(root, { onAdd });
    const input = root.querySelector(".pc-inv-custom-input input") as HTMLInputElement;
    input.value = "  50 ft of hempen rope  ";
    (root.querySelector(".pc-inv-custom-input button") as HTMLElement).click();
    expect(onAdd).toHaveBeenCalledWith("50 ft of hempen rope");
  });

  it("Enter key in input triggers Add", () => {
    const onAdd = vi.fn();
    const root = mountContainer();
    renderCustomItemInput(root, { onAdd });
    const input = root.querySelector(".pc-inv-custom-input input") as HTMLInputElement;
    input.value = "Torch";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onAdd).toHaveBeenCalledWith("Torch");
  });

  it("does NOT call onAdd when input is empty", () => {
    const onAdd = vi.fn();
    const root = mountContainer();
    renderCustomItemInput(root, { onAdd });
    (root.querySelector(".pc-inv-custom-input button") as HTMLElement).click();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
