/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SaveChip } from "../src/modules/pc/components/save-chip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

describe("SaveChip (component) — interactive (SP4)", () => {
  function interactiveCtx(opts: {
    ability?: "str" | "dex";
    classSaves?: string[];
    overrideProf?: boolean;  // undefined = no override set
    bonus?: number;
  } = {}) {
    const editState = {
      toggleSaveProficient: vi.fn(),
      clearSaveOverride: vi.fn(),
    };
    const abl = opts.ability ?? "str";
    const classSaves = opts.classSaves ?? [];
    const hasOverride = opts.overrideProf !== undefined;
    const overrides: Record<string, unknown> = {};
    if (hasOverride) overrides[abl] = { bonus: 0, proficient: opts.overrideProf };
    return {
      ability: abl,
      ctx: {
        derived: { saves: { [abl]: { bonus: opts.bonus ?? 0, proficient: classSaves.includes(abl) || opts.overrideProf === true } } },
        resolved: {
          classes: [{ entity: { saving_throws: classSaves } }],
          definition: { overrides: { saves: Object.keys(overrides).length ? overrides : undefined } },
        },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("renders override * mark when override is present", () => {
    const root = mountContainer();
    const { ctx, ability } = interactiveCtx({ classSaves: [], overrideProf: true });
    new SaveChip(ability as "str").render(root, ctx);
    expect(root.querySelector(".archivist-override-mark")?.textContent).toBe("*");
  });

  it("does NOT render * when no override", () => {
    const root = mountContainer();
    const { ctx, ability } = interactiveCtx({ classSaves: ["str"] });
    new SaveChip(ability as "str").render(root, ctx);
    expect(root.querySelector(".archivist-override-mark")).toBeNull();
  });

  it("click on chip calls toggleSaveProficient", () => {
    const root = mountContainer();
    const { ctx, editState, ability } = interactiveCtx({ classSaves: ["str"] });
    new SaveChip(ability as "str").render(root, ctx);
    root.querySelector<HTMLElement>(".pc-save-chip")!.click();
    expect(editState.toggleSaveProficient).toHaveBeenCalledWith("str");
  });

  it("click on * mark calls clearSaveOverride (and stops propagation)", () => {
    const root = mountContainer();
    const { ctx, editState, ability } = interactiveCtx({ classSaves: [], overrideProf: true });
    new SaveChip(ability as "str").render(root, ctx);
    root.querySelector<HTMLElement>(".archivist-override-mark")!.click();
    expect(editState.clearSaveOverride).toHaveBeenCalledWith("str");
    // toggleSaveProficient must NOT have been called (stopPropagation worked)
    expect(editState.toggleSaveProficient).not.toHaveBeenCalled();
  });
});
