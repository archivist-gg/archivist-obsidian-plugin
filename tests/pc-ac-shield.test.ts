/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { AcShield } from "../src/modules/pc/components/ac-shield";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(opts: { ac: number; overrideAc?: number; editState?: unknown }): ComponentRenderContext {
  const overrides = opts.overrideAc !== undefined ? { ac: opts.overrideAc } : {};
  return {
    derived: { ac: opts.ac },
    resolved: { definition: { overrides } },
    editState: opts.editState ?? null,
  } as unknown as ComponentRenderContext;
}

describe("AcShield", () => {
  it("renders the AC number", () => {
    const root = mountContainer();
    new AcShield().render(root, ctx({ ac: 15 }));
    expect(root.querySelector(".pc-ac-shield-num")?.textContent).toBe("15");
  });

  it("no edit behavior when editState is null", () => {
    const root = mountContainer();
    new AcShield().render(root, ctx({ ac: 15 }));
    root.querySelector<HTMLElement>(".pc-ac-shield-num")!.click();
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
  });

  it("click number opens input, Enter calls editState.setAcOverride (SP4b)", () => {
    const root = mountContainer();
    const editState = { setAcOverride: vi.fn(), clearAcOverride: vi.fn() };
    new AcShield().render(root, ctx({ ac: 15, editState }));
    root.querySelector<HTMLElement>(".pc-ac-shield-num")!.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline")!;
    input.value = "18";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(editState.setAcOverride).toHaveBeenCalledWith(18);
  });

  it("override mark appears when overrides.ac is set; click clears (SP4b)", () => {
    const root = mountContainer();
    const editState = { setAcOverride: vi.fn(), clearAcOverride: vi.fn() };
    new AcShield().render(root, ctx({ ac: 18, overrideAc: 18, editState }));
    const mark = root.querySelector<HTMLElement>(".archivist-override-mark");
    expect(mark).not.toBeNull();
    mark!.click();
    expect(editState.clearAcOverride).toHaveBeenCalledTimes(1);
  });
});
