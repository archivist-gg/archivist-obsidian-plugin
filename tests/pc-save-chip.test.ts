/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SaveChip } from "../src/modules/pc/components/save-chip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

describe("SaveChip (component) — interactive (SP4 + SP4c)", () => {
  function interactiveCtx(opts: {
    ability?: "str" | "dex";
    classSaves?: string[];
    overrideProf?: boolean;
    overrideBonus?: number;
    bonus?: number;
  } = {}) {
    const editState = {
      toggleSaveProficient: vi.fn(),
      clearSaveProficientOverride: vi.fn(),
      setSaveBonusOverride: vi.fn(),
      clearSaveBonusOverride: vi.fn(),
    };
    const abl = opts.ability ?? "str";
    const classSaves = opts.classSaves ?? [];
    const profSet = opts.overrideProf !== undefined;
    const bonusSet = opts.overrideBonus !== undefined;
    const overridesEntry: Record<string, unknown> = {};
    if (profSet) overridesEntry.proficient = opts.overrideProf;
    if (bonusSet) overridesEntry.bonus = opts.overrideBonus;
    const overrides: Record<string, unknown> = {};
    if (profSet || bonusSet) overrides[abl] = overridesEntry;
    const effectiveProf = profSet ? opts.overrideProf! : classSaves.includes(abl);
    return {
      ability: abl,
      ctx: {
        derived: { saves: { [abl]: { bonus: opts.bonus ?? 0, proficient: effectiveProf } } },
        resolved: {
          classes: [{ entity: { saving_throws: classSaves } }],
          definition: { overrides: { saves: Object.keys(overrides).length ? overrides : undefined } },
        },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("renders chip-level override mark when only the proficient half is overridden", () => {
    const root = mountContainer();
    const { ctx, ability } = interactiveCtx({ classSaves: [], overrideProf: true });
    new SaveChip(ability as "str").render(root, ctx);
    // Chip-level mark is a direct child of the chip (not inside .pc-save-bn).
    const chip = root.querySelector(".pc-save-chip")!;
    const directMark = [...chip.children].find((c) => c.classList.contains("archivist-override-mark"));
    expect(directMark?.textContent).toBe("*");
  });

  it("chip-level override mark tooltip mentions proficiency", () => {
    const root = mountContainer();
    const { ctx, ability } = interactiveCtx({ classSaves: [], overrideProf: true });
    new SaveChip(ability as "str").render(root, ctx);
    const chip = root.querySelector(".pc-save-chip")!;
    const directMark = [...chip.children].find((c) => c.classList.contains("archivist-override-mark"));
    expect(directMark?.getAttribute("title")).toContain("proficiency override");
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

  it("click on chip-level * mark calls clearSaveProficientOverride and stops propagation", () => {
    const root = mountContainer();
    const { ctx, editState, ability } = interactiveCtx({ classSaves: [], overrideProf: true });
    new SaveChip(ability as "str").render(root, ctx);
    const chip = root.querySelector(".pc-save-chip")!;
    const directMark = [...chip.children].find((c): c is HTMLElement => c.classList.contains("archivist-override-mark"))!;
    directMark.click();
    expect(editState.clearSaveProficientOverride).toHaveBeenCalledWith("str");
    expect(editState.toggleSaveProficient).not.toHaveBeenCalled();
  });
});

describe("SaveChip — bonus override split-click (SP4c)", () => {
  function ctxWith(opts: { overrideProf?: boolean; overrideBonus?: number; bonus?: number } = {}) {
    const editState = {
      toggleSaveProficient: vi.fn(),
      clearSaveProficientOverride: vi.fn(),
      setSaveBonusOverride: vi.fn(),
      clearSaveBonusOverride: vi.fn(),
    };
    const profSet = opts.overrideProf !== undefined;
    const bonusSet = opts.overrideBonus !== undefined;
    const entry: Record<string, unknown> = {};
    if (profSet) entry.proficient = opts.overrideProf;
    if (bonusSet) entry.bonus = opts.overrideBonus;
    const saves = (profSet || bonusSet) ? { str: entry } : undefined;
    const effectiveProf = profSet ? opts.overrideProf! : false;
    return {
      ctx: {
        derived: { saves: { str: { bonus: opts.bonus ?? 0, proficient: effectiveProf } } },
        resolved: {
          classes: [{ entity: { saving_throws: [] } }],
          definition: { overrides: { saves } },
        },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("clicking .pc-save-bn opens an inline number input", () => {
    const root = mountContainer();
    const { ctx } = ctxWith({ bonus: 4 });
    new SaveChip("str").render(root, ctx);
    root.querySelector<HTMLElement>(".pc-save-bn")!.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline");
    expect(input).not.toBeNull();
    expect(input!.value).toBe("4");
  });

  it("clicking .pc-save-bn does NOT trigger toggleSaveProficient (stopPropagation)", () => {
    const root = mountContainer();
    const { ctx, editState } = ctxWith({ bonus: 4 });
    new SaveChip("str").render(root, ctx);
    root.querySelector<HTMLElement>(".pc-save-bn")!.click();
    expect(editState.toggleSaveProficient).not.toHaveBeenCalled();
  });

  it("renders bonus-half mark inside .pc-save-bn when only bonus override is set", () => {
    const root = mountContainer();
    const { ctx } = ctxWith({ overrideBonus: 7, bonus: 7 });
    new SaveChip("str").render(root, ctx);
    const bonusEl = root.querySelector(".pc-save-bn")!;
    expect(bonusEl.querySelector(".archivist-override-mark")).not.toBeNull();
    // No chip-level mark when proficient half is not overridden.
    const chip = root.querySelector(".pc-save-chip")!;
    const directMark = [...chip.children].find((c) => c.classList.contains("archivist-override-mark"));
    expect(directMark).toBeUndefined();
  });

  it("renders BOTH marks when both halves are overridden", () => {
    const root = mountContainer();
    const { ctx } = ctxWith({ overrideProf: true, overrideBonus: 9, bonus: 9 });
    new SaveChip("str").render(root, ctx);
    const chip = root.querySelector(".pc-save-chip")!;
    const directMark = [...chip.children].find((c) => c.classList.contains("archivist-override-mark"));
    expect(directMark).not.toBeUndefined();
    expect(root.querySelector(".pc-save-bn .archivist-override-mark")).not.toBeNull();
  });

  it("clicking the bonus-half mark calls clearSaveBonusOverride and not the chip handler", () => {
    const root = mountContainer();
    const { ctx, editState } = ctxWith({ overrideBonus: 7, bonus: 7 });
    new SaveChip("str").render(root, ctx);
    const mark = root.querySelector<HTMLElement>(".pc-save-bn .archivist-override-mark")!;
    mark.click();
    expect(editState.clearSaveBonusOverride).toHaveBeenCalledWith("str");
    expect(editState.toggleSaveProficient).not.toHaveBeenCalled();
  });
});
