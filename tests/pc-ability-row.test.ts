/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { AbilityRow } from "../src/modules/pc/components/ability-row";
import { ComponentRegistry } from "../src/modules/pc/components/component-registry";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function makeRegistryWithStubSaveChips(): ComponentRegistry {
  const reg = new ComponentRegistry();
  for (const ab of ["str", "dex", "con", "int", "wis", "cha"]) {
    reg.register({
      type: `save-chip-${ab}`,
      render: (el: HTMLElement) => { el.createDiv({ cls: `stub-save-${ab}` }); },
    });
  }
  return reg;
}

function ctx(opts: { scoreOverrides?: Record<string, number>; editState?: unknown } = {}): ComponentRenderContext {
  const overrides = opts.scoreOverrides ? { scores: opts.scoreOverrides } : {};
  return {
    derived: {
      mods: { str: 2, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
      scores: { str: 14, dex: 12, con: 13, int: 10, wis: 12, cha: 11 },
      saves: {},
    },
    resolved: { definition: { overrides } },
    editState: opts.editState ?? null,
  } as unknown as ComponentRenderContext;
}

describe("AbilityRow — click-to-edit score pill (SP4b)", () => {
  it("renders six cartouches with score pills", () => {
    const root = mountContainer();
    new AbilityRow(makeRegistryWithStubSaveChips()).render(root, ctx());
    expect(root.querySelectorAll(".pc-ab-score").length).toBe(6);
  });

  it("click STR score opens input, Enter commits setScoreOverride", () => {
    const root = mountContainer();
    const editState = { setScoreOverride: vi.fn(), clearScoreOverride: vi.fn() };
    new AbilityRow(makeRegistryWithStubSaveChips()).render(root, ctx({ editState }));
    const str = root.querySelector<HTMLElement>(".pc-ab[data-ability='str'] .pc-ab-score")!;
    str.click();
    const input = root.querySelector<HTMLInputElement>(".pc-ab[data-ability='str'] input.pc-edit-inline")!;
    input.value = "18";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(editState.setScoreOverride).toHaveBeenCalledWith("str", 18);
  });

  it("override mark appears on DEX score pill when overridden", () => {
    const root = mountContainer();
    const editState = { setScoreOverride: vi.fn(), clearScoreOverride: vi.fn() };
    new AbilityRow(makeRegistryWithStubSaveChips()).render(root, ctx({
      editState,
      scoreOverrides: { dex: 16 },
    }));
    const dex = root.querySelector(".pc-ab[data-ability='dex']");
    expect(dex?.querySelector(".archivist-override-mark")).not.toBeNull();
    const str = root.querySelector(".pc-ab[data-ability='str']");
    expect(str?.querySelector(".archivist-override-mark")).toBeNull();
  });

  it("click override mark calls clearScoreOverride(ab)", () => {
    const root = mountContainer();
    const editState = { setScoreOverride: vi.fn(), clearScoreOverride: vi.fn() };
    new AbilityRow(makeRegistryWithStubSaveChips()).render(root, ctx({
      editState,
      scoreOverrides: { dex: 16 },
    }));
    root.querySelector<HTMLElement>(".pc-ab[data-ability='dex'] .archivist-override-mark")!.click();
    expect(editState.clearScoreOverride).toHaveBeenCalledWith("dex");
  });
});
