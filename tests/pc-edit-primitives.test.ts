/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { makeInlineInput } from "../src/modules/pc/components/edit-primitives";

beforeAll(() => installObsidianDomHelpers());

describe("makeInlineInput", () => {
  it("replaces valueEl with an <input type=number> sized inline", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "17" });
    makeInlineInput(valueEl, { initial: 17, onCommit: () => {}, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline");
    expect(input).not.toBeNull();
    expect(input!.type).toBe("number");
    expect(input!.value).toBe("17");
    expect(root.querySelector(".pc-val")).toBeNull();
  });

  it("calls onCommit(parsedInt) on Enter and clamps to [min, max]", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    makeInlineInput(valueEl, { initial: 10, min: 0, max: 30, onCommit, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "50";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onCommit).toHaveBeenCalledWith(30);
  });

  it("calls onCancel on Escape and does not call onCommit", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 10, onCommit, onCancel });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("calls onCommit on blur with current value (clamped)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    makeInlineInput(valueEl, { initial: 10, min: 1, max: 20, onCommit, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "-5";
    input.dispatchEvent(new Event("blur"));
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("stops keyboard event propagation on keydown/keyup/keypress", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "5" });
    makeInlineInput(valueEl, { initial: 5, onCommit: () => {}, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    const parentSpy = vi.fn();
    root.addEventListener("keydown", parentSpy);
    root.addEventListener("keyup", parentSpy);
    root.addEventListener("keypress", parentSpy);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "7", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "7", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keypress", { key: "7", bubbles: true }));
    expect(parentSpy).not.toHaveBeenCalled();
  });

  it("does not double-fire onCommit when Enter then blur fire in succession", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "5" });
    const onCommit = vi.fn();
    makeInlineInput(valueEl, { initial: 5, onCommit, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "7";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    input.dispatchEvent(new Event("blur"));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(7);
  });
});
