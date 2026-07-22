/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { makeInlineInput, numberField, numberOverride, cancelInlineEdit } from "../packages/obsidian/src/modules/pc/components/edit-primitives";

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
    // Original div was detached. The input now ALSO carries .pc-val
    // (class preservation, Bug A fix), so we check the div tag is gone.
    expect(root.querySelector("div.pc-val")).toBeNull();
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

  it("input preserves valueEl's className for layout inheritance (Bug A)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-skill-bonus pc-edit-click", text: "+5" });
    makeInlineInput(valueEl, { initial: 5, onCommit: () => {}, onCancel: () => {} });
    const input = root.querySelector<HTMLInputElement>("input")!;
    expect(input.classList.contains("pc-edit-inline")).toBe(true);
    expect(input.classList.contains("pc-skill-bonus")).toBe(true);
    expect(input.classList.contains("pc-edit-click")).toBe(true);
  });

  it("Escape key restores valueEl in place of input (Bug C)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "18" });
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 18, onCommit: () => {}, onCancel });
    // input is in the DOM, valueEl div is detached. Note: the input also
    // carries .pc-val (class preservation, Bug A fix), so check div tag.
    expect(root.querySelector("input.pc-edit-inline")).not.toBeNull();
    expect(root.querySelector("div.pc-val")).toBeNull();
    // Escape cancels
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    // valueEl restored, input gone
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
    expect(root.querySelector("div.pc-val")?.textContent).toBe("18");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("blur with the value UNCHANGED from initial calls onCancel and does NOT call onCommit", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 10, onCommit, onCancel });
    const input = root.querySelector<HTMLInputElement>("input")!;
    // No edit at all: click in, click away.
    input.dispatchEvent(new FocusEvent("blur"));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    // valueEl restored in place of the input (same cancel path as Escape).
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
    expect(root.querySelector("div")?.textContent).toBe("10");
  });

  it("blur after typing then reverting the value back to initial also cancels (no spurious commit)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 10, onCommit, onCancel });
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.value = "15";
    input.value = "10";
    input.dispatchEvent(new FocusEvent("blur"));
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Enter with the value UNCHANGED from initial still commits (explicit intent)", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 10, onCommit, onCancel });
    const input = root.querySelector<HTMLInputElement>("input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onCommit).toHaveBeenCalledWith(10);
    expect(onCancel).not.toHaveBeenCalled();
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

describe("cancelInlineEdit", () => {
  it("cancels an active edit: restores valueEl, fires onCancel, returns true", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ cls: "pc-val", text: "17" });
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 17, onCommit, onCancel });
    expect(cancelInlineEdit(root)).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
    expect(root.querySelector("div.pc-val")).not.toBeNull();
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
  });

  it("returns false when no inline edit is active", () => {
    const root = mountContainer();
    expect(cancelInlineEdit(root)).toBe(false);
  });

  it("returns false after an Enter-commit even while the input is still in the DOM", () => {
    const root = mountContainer();
    const valueEl = root.createDiv({ text: "10" });
    const onCancel = vi.fn();
    makeInlineInput(valueEl, { initial: 10, onCommit: () => {}, onCancel });
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "12";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    // commit() does not remove the input from the DOM; the registry cleanup on
    // `done` is what makes the edit no longer "active".
    expect(root.querySelector("input.pc-edit-inline")).not.toBeNull();
    expect(cancelInlineEdit(root)).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
