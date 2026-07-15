/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SaveChip } from "../packages/obsidian/src/modules/pc/components/save-chip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

describe("SaveChip (component) — interactive (SP4 + SP4c)", () => {
  function interactiveCtx(opts: {
    ability?: "str" | "dex" | "wis" | "cha";
    classSaves?: string[];
    overrideProf?: boolean;
    overrideBonus?: number;
    bonus?: number;
    rollModifiers?: unknown[];
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
        derived: {
          saves: { [abl]: { bonus: opts.bonus ?? 0, proficient: effectiveProf } },
          rollModifiers: opts.rollModifiers ?? [],
        },
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

  describe("save-scoped roll-modifier tags (#11b)", () => {
    it("renders an ADV tag in the .pc-save-tags sub-line, not inside the nowrap save chip", () => {
      const root = mountContainer();
      const { ctx } = interactiveCtx({
        ability: "cha",
        rollModifiers: [{ mode: "advantage", roll: "saving-throw", scope: "cha", label: "Heroic Resolve" }],
      });
      new SaveChip("cha").render(root, ctx);
      const chip = root.querySelector(".pc-save-chip")!;
      const tags = root.querySelector(".pc-save-tags")!;
      expect(tags).toBeTruthy();
      expect(chip.querySelector(".pc-cond-tag")).toBeNull();       // NOT inside the chip anymore
      expect(tags.querySelector(".pc-cond-tag-adv")).toBeTruthy(); // in the sub-line
    });

    it("renders ADV on a save with a saving-throw advantage roll-modifier (#11b)", () => {
      const root = mountContainer();
      const { ctx } = interactiveCtx({
        ability: "wis",
        rollModifiers: [{ mode: "advantage", roll: "saving-throw", scope: "wis", label: "Dual Mind" }],
      });
      new SaveChip("wis").render(root, ctx);
      const tag = root.querySelector(".pc-cond-tag");
      expect(tag?.textContent).toContain("ADV");
    });

    it("does NOT render ADV on a save whose scope doesn't match (roll-modifier)", () => {
      const root = mountContainer();
      const { ctx } = interactiveCtx({
        ability: "cha",
        rollModifiers: [{ mode: "advantage", roll: "saving-throw", scope: "wis", label: "Dual Mind" }],
      });
      new SaveChip("cha").render(root, ctx);
      expect(root.querySelector(".pc-cond-tag")).toBeNull();
    });

    it("renders a scopeless saving-throw roll-modifier on every save chip", () => {
      const mods = [{ mode: "disadvantage", roll: "saving-throw", label: "Frightened" }];
      for (const abl of ["wis", "cha"] as const) {
        const root = mountContainer();
        const { ctx } = interactiveCtx({ ability: abl, rollModifiers: mods });
        new SaveChip(abl).render(root, ctx);
        expect(root.querySelector(".pc-cond-tag.pc-cond-tag-dis")?.textContent).toBe("DIS");
      }
    });

    it("ignores non-saving-throw roll-modifiers on save chips", () => {
      const root = mountContainer();
      const { ctx } = interactiveCtx({
        ability: "wis",
        rollModifiers: [
          { mode: "advantage", roll: "ability-check", scope: "wis", label: "Perceptive" },
          { mode: "advantage", roll: "attack", label: "Pack Tactics" },
        ],
      });
      new SaveChip("wis").render(root, ctx);
      expect(root.querySelector(".pc-cond-tag")).toBeNull();
    });
  });
});

describe("SaveChip — situational saves tooltip (Task 9)", () => {
  function ctxWithSavesInfo(info?: unknown): ComponentRenderContext {
    return {
      derived: {
        saves: { str: { bonus: 3, proficient: true } },
        ...(info !== undefined ? { savesInformational: info } : {}),
      },
      resolved: {
        classes: [{ entity: { saving_throws: ["str"] } }],
        definition: { overrides: { saves: undefined } },
      },
      editState: null,
    } as unknown as ComponentRenderContext;
  }

  it("shows a situational popover on hover over the save chip when the slice is non-empty", () => {
    const root = mountContainer();
    new SaveChip("str").render(root, ctxWithSavesInfo([
      { field: "saving_throws", source: "Ring of Protection", value: 1, conditions: [{ kind: "raw", text: "while attuned" }] },
    ]));
    const chip = root.querySelector<HTMLElement>(".pc-save-chip")!;
    chip.dispatchEvent(new Event("mouseenter"));
    const tip = chip.querySelector(".pc-stat-tooltip");
    expect(tip).not.toBeNull();
    expect(tip?.querySelector(".pc-stat-tooltip-title")?.textContent).toBe("Saves — situational");
    const rows = tip!.querySelectorAll(".pc-situational-row");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Ring of Protection");
  });

  it("attaches NO popover when the saves slice is absent (situational-free character)", () => {
    const root = mountContainer();
    new SaveChip("str").render(root, ctxWithSavesInfo(undefined));
    const chip = root.querySelector<HTMLElement>(".pc-save-chip")!;
    chip.dispatchEvent(new Event("mouseenter"));
    expect(chip.querySelector(".pc-stat-tooltip")).toBeNull();
  });

  it("attaches NO popover when the saves slice is empty", () => {
    const root = mountContainer();
    new SaveChip("str").render(root, ctxWithSavesInfo([]));
    const chip = root.querySelector<HTMLElement>(".pc-save-chip")!;
    chip.dispatchEvent(new Event("mouseenter"));
    expect(chip.querySelector(".pc-stat-tooltip")).toBeNull();
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
