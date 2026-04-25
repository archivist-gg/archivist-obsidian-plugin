/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SensesPanel } from "../src/modules/pc/components/senses-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {
    passives: { perception: 14, investigation: 10, insight: 11 },
  } as DerivedStats,
  core: {} as never,
  editState: null,
};

describe("SensesPanel", () => {
  it("renders three passive rows", () => {
    const container = mountContainer();
    new SensesPanel().render(container, ctx);
    expect(container.querySelectorAll(".pc-sense-row").length).toBe(3);
  });
  it("shows perception, investigation, insight values", () => {
    const container = mountContainer();
    new SensesPanel().render(container, ctx);
    const vals = [...container.querySelectorAll(".pc-sense-val")].map((v) => v.textContent);
    expect(vals).toEqual(["14", "10", "11"]);
  });
});

describe("SensesPanel — interactive overrides (SP4c)", () => {
  function interactiveCtx(opts: {
    perception?: number;
    investigation?: number;
    insight?: number;
    overrides?: { perception?: number; investigation?: number; insight?: number };
  } = {}): { ctx: ComponentRenderContext; editState: { setPassiveOverride: ReturnType<typeof vi.fn>; clearPassiveOverride: ReturnType<typeof vi.fn> } } {
    const editState = {
      setPassiveOverride: vi.fn(),
      clearPassiveOverride: vi.fn(),
    };
    return {
      ctx: {
        derived: {
          passives: {
            perception: opts.perception ?? 14,
            investigation: opts.investigation ?? 10,
            insight: opts.insight ?? 11,
          },
        },
        resolved: { definition: { overrides: { passives: opts.overrides } } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("clicking perception value opens an inline input with the integer", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ perception: 14 });
    new SensesPanel().render(root, ctx);
    const valEl = root.querySelectorAll<HTMLElement>(".pc-sense-val")[0];
    valEl.click();
    const input = root.querySelector<HTMLInputElement>("input.pc-edit-inline");
    expect(input).not.toBeNull();
    expect(input!.value).toBe("14");
  });

  it("override mark renders only on the overridden sense", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtx({ perception: 18, overrides: { perception: 18 } });
    new SensesPanel().render(root, ctx);
    const rows = [...root.querySelectorAll(".pc-sense-row")];
    expect(rows[0].querySelector(".archivist-override-mark")).not.toBeNull(); // perception
    expect(rows[1].querySelector(".archivist-override-mark")).toBeNull();     // investigation
    expect(rows[2].querySelector(".archivist-override-mark")).toBeNull();     // insight
  });

  it("clicking the override mark calls clearPassiveOverride with the right kind", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtx({ insight: 16, overrides: { insight: 16 } });
    new SensesPanel().render(root, ctx);
    const insightRow = root.querySelectorAll(".pc-sense-row")[2];
    insightRow.querySelector<HTMLElement>(".archivist-override-mark")!.click();
    expect(editState.clearPassiveOverride).toHaveBeenCalledWith("insight");
  });

  it("editState=null leaves rows read-only (no marks, no edit on click)", () => {
    const root = mountContainer();
    new SensesPanel().render(root, {
      derived: { passives: { perception: 14, investigation: 10, insight: 11 } },
      resolved: { definition: { overrides: {} } },
      editState: null,
    } as unknown as ComponentRenderContext);
    expect(root.querySelector(".archivist-override-mark")).toBeNull();
    root.querySelector<HTMLElement>(".pc-sense-val")!.click();
    expect(root.querySelector("input.pc-edit-inline")).toBeNull();
  });
});
