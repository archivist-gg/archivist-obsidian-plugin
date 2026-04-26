/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { currencyCell } from "../src/modules/pc/components/edit-primitives";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("currencyCell", () => {
  it("renders label + value, click swaps to input, Enter commits", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const onSet = vi.fn();
    currencyCell(root, { coin: "GP", value: 150, onSet });
    expect(root.querySelector(".pc-currency-val")?.textContent).toBe("150");

    (root.querySelector(".pc-currency-val") as HTMLElement).click();
    const input = root.querySelector("input");
    expect(input).not.toBeNull();
    input!.value = "275";
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSet).toHaveBeenCalledWith(275);
  });

  it("Escape cancels", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const onSet = vi.fn();
    currencyCell(root, { coin: "GP", value: 150, onSet });
    (root.querySelector(".pc-currency-val") as HTMLElement).click();
    const input = root.querySelector("input")!;
    input.value = "275";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onSet).not.toHaveBeenCalled();
  });
});
