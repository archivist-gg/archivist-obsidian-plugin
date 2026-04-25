/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { makeInlineInput, numberField, numberOverride } from "../src/modules/pc/components/edit-primitives";

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

describe("numberField", () => {
  it("clicking valueEl opens inline input preloaded with getValue()", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "12" });
    let value = 12;
    numberField(valueEl, { getValue: () => value, onSet: (n) => { value = n; } });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline");
    expect(input?.value).toBe("12");
  });

  it("commit calls onSet with new value", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "12" });
    const onSet = vi.fn();
    numberField(valueEl, { getValue: () => 12, onSet });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "20";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSet).toHaveBeenCalledWith(20);
  });

  it("cancel leaves value unchanged and does not call onSet", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "12" });
    const onSet = vi.fn();
    numberField(valueEl, { getValue: () => 12, onSet });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onSet).not.toHaveBeenCalled();
  });

  it("reads from getValue(), not valueEl.textContent (temp HP dash safety)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "—" });
    const onSet = vi.fn();
    numberField(valueEl, { getValue: () => 0, onSet });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    expect(input.value).toBe("0");
  });

  it("respects min/max clamps on commit", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "5" });
    const onSet = vi.fn();
    numberField(valueEl, { getValue: () => 5, onSet, min: 0, max: 10 });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "999";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSet).toHaveBeenCalledWith(10);
  });
});

describe("numberOverride", () => {
  it("renders no override mark when isOverridden() is false", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "10" });
    numberOverride(valueEl, {
      getEffective: () => 10,
      isOverridden: () => false,
      onSet: () => {},
      onClear: () => {},
    });
    expect(root.querySelector(".archivist-override-mark")).toBeNull();
  });

  it("renders crimson * after valueEl when isOverridden() is true", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "14" });
    numberOverride(valueEl, {
      getEffective: () => 14,
      isOverridden: () => true,
      onSet: () => {},
      onClear: () => {},
    });
    const mark = root.querySelector<HTMLElement>(".archivist-override-mark");
    expect(mark).not.toBeNull();
    expect(mark!.textContent).toBe("*");
    expect(mark!.parentElement).toBe(valueEl);
  });

  it("click on valueEl opens input with getEffective() value and commit calls onSet", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "14" });
    const onSet = vi.fn();
    numberOverride(valueEl, {
      getEffective: () => 14,
      isOverridden: () => false,
      onSet,
      onClear: () => {},
    });
    valueEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    expect(input.value).toBe("14");
    input.value = "18";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onSet).toHaveBeenCalledWith(18);
  });

  it("click on override mark calls onClear and stops propagation to valueEl", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "18" });
    const onClear = vi.fn();
    const onSet = vi.fn();
    numberOverride(valueEl, {
      getEffective: () => 18,
      isOverridden: () => true,
      onSet,
      onClear,
    });
    const mark = root.querySelector<HTMLElement>(".archivist-override-mark")!;
    mark.click();
    expect(onClear).toHaveBeenCalledTimes(1);
    // The mark click must NOT bubble to valueEl (which would open an input)
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
    expect(onSet).not.toHaveBeenCalled();
  });

  it("override mark click is gated on confirm — onClear NOT called when user cancels", () => {
    vi.stubGlobal("confirm", () => false);
    try {
      const root = mountContainer();
      const valueEl = root.createDiv({ cls: "pc-val", text: "18" });
      const onClear = vi.fn();
      numberOverride(valueEl, {
        getEffective: () => 18,
        isOverridden: () => true,
        onSet: vi.fn(),
        onClear,
      });
      root.querySelector<HTMLElement>(".archivist-override-mark")!.click();
      expect(onClear).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
