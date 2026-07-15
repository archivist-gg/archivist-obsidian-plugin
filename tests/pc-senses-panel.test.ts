/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SensesPanel } from "../packages/obsidian/src/modules/pc/components/senses-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {
    passives: { perception: 14, investigation: 10, insight: 11 },
  } as DerivedStats,
  services: {} as never,
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

describe("SensesPanel — senses", () => {
  const mkCtx = (senses?: Partial<DerivedStats["senses"]>): ComponentRenderContext => ({
    resolved: {} as ResolvedCharacter,
    derived: {
      passives: { perception: 14, investigation: 10, insight: 11 },
      ...(senses
        ? { senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0, ...senses } }
        : {}),
    } as DerivedStats,
    services: {} as never,
    editState: null,
  });

  it("renders a darkvision row when derived.senses.darkvision > 0", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx({ darkvision: 60 }));
    const rows = [...container.querySelectorAll(".pc-sense-row")];
    expect(rows.length).toBe(4);
    // Darkvision renders after the three passive rows.
    expect(rows[3].querySelector(".pc-sense-name")?.textContent).toBe("Darkvision");
    const dist = container.querySelector(".pc-sense-dist");
    expect(dist?.textContent).toBe("60 ft.");
    const names = [...container.querySelectorAll(".pc-sense-name")].map((v) => v.textContent);
    expect(names).toContain("Darkvision");
  });

  it("renders no darkvision row when darkvision is 0", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx({ darkvision: 0 }));
    expect(container.querySelectorAll(".pc-sense-row").length).toBe(3);
  });

  it("renders no darkvision row when senses is absent (legacy cast fixtures)", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx(undefined));
    expect(container.querySelectorAll(".pc-sense-row").length).toBe(3);
  });

  it("renders a non-darkvision sense row and no Darkvision row", () => {
    const container = mountContainer();
    new SensesPanel().render(
      container,
      mkCtx({ darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 30 }),
    );
    const rows = [...container.querySelectorAll(".pc-sense-row")];
    expect(rows.length).toBe(4);
    expect(rows[3].querySelector(".pc-sense-name")?.textContent).toBe("Truesight");
    expect(rows[3].querySelector(".pc-sense-dist")?.textContent).toBe("30 ft.");
    const names = [...container.querySelectorAll(".pc-sense-name")].map((v) => v.textContent);
    expect(names).not.toContain("Darkvision");
  });
});

describe("SensesPanel — Size (relocated from race-block, AC-size)", () => {
  // Size was previously surfaced ONLY by the now-retired race-block; §3.8 moves
  // it here so retiring that block does not silently drop it. Read from
  // ctx.resolved.race.size via cast — there is no derived.size.
  const mkCtx = (size?: string): ComponentRenderContext => ({
    resolved: (size ? { race: { size } } : {}) as unknown as ResolvedCharacter,
    derived: { passives: { perception: 14, investigation: 10, insight: 11 } } as DerivedStats,
    services: {} as never,
    editState: null,
  });

  it("renders a Size row reading the resolved race size", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx("Small"));
    const names = [...container.querySelectorAll(".pc-sense-name")].map((v) => v.textContent);
    expect(names).toContain("Size");
    const sizeRow = [...container.querySelectorAll(".pc-sense-row")].find(
      (r) => r.querySelector(".pc-sense-name")?.textContent === "Size",
    );
    expect(sizeRow?.querySelector(".pc-sense-dist")?.textContent).toBe("Small");
  });

  it("renders no Size row when the resolved race has no size", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx(undefined));
    expect(container.querySelectorAll(".pc-sense-row").length).toBe(3); // 3 passive rows only
    const names = [...container.querySelectorAll(".pc-sense-name")].map((v) => v.textContent);
    expect(names).not.toContain("Size");
  });

  it("Size row does not displace the first passive row (perception stays first)", () => {
    const container = mountContainer();
    new SensesPanel().render(container, mkCtx("Medium"));
    const first = container.querySelectorAll(".pc-sense-row")[0];
    expect(first.querySelector(".pc-sense-name")?.textContent).toBe("Perception");
  });
});
