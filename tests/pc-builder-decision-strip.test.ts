/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionStrip, domainPill } from "../src/modules/pc/components/builder/decision-strip";
import type { DecisionItem } from "../src/modules/pc/pc.decision-engine";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

const item = (over: Partial<DecisionItem>): DecisionItem =>
  ({
    key: "elven-lineage",
    source: { kind: "race" },
    level: 0,
    featureName: "Elven Lineage",
    choice: { kind: "select-inline", id: "elven-lineage", count: 1, options: [] },
    options: [
      { value: "drow", label: "Drow" },
      { value: "wood-elf", label: "Wood Elf" },
    ],
    selected: undefined,
    status: "unresolved",
    ...over,
  }) as DecisionItem;

const mkCtx = (editState: Record<string, unknown> = {}): ComponentRenderContext =>
  ({ resolved: { definition: {} }, derived: {}, core: { entities: {} }, editState, builderUiState: new Map() }) as unknown as ComponentRenderContext;

describe("renderDecisionStrip", () => {
  it("unresolved row wears the open dress with chips mounted", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: true, stateKey: "t" });
    const row = c.querySelector(".pc-dstrip-row")!;
    expect(row.classList.contains("open")).toBe(true);
    expect(row.querySelector(".pc-dstrip-bang")).not.toBeNull();
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
  });

  it("resolved row wears green but KEEPS its chips (always-open)", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), {
      items: [item({ status: "resolved", selected: "wood-elf" })],
      pill: domainPill, live: true, stateKey: "t",
    });
    const row = c.querySelector(".pc-dstrip-row")!;
    expect(row.classList.contains("done")).toBe(true);
    expect(row.querySelector(".pc-dstrip-bang")).toBeNull();
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(2);
    expect(row.querySelector(".pc-bchoice-chip.sel")!.textContent).toContain("Wood Elf");
    expect(row.querySelector(".pc-dstrip-val")!.textContent).toContain("Wood Elf");
  });

  it("chip click writes the origin choice", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setOriginChoice }), { items: [item({})], pill: domainPill, live: true, stateKey: "t" });
    (c.querySelector(".pc-bchoice-chip") as HTMLElement).click();
    expect(setOriginChoice).toHaveBeenCalledWith("race:elven-lineage", "drow");
  });

  it("browse mode renders rows without controls", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({})], pill: domainPill, live: false, stateKey: "t" });
    expect(c.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
    expect(c.querySelector(".pc-dstrip-row.req")).not.toBeNull();
  });

  it("informational item renders featureName only, quietly", () => {
    const c = mountContainer();
    renderDecisionStrip(c, mkCtx(), { items: [item({ status: "informational" })], pill: domainPill, live: true, stateKey: "t" });
    const row = c.querySelector(".pc-dstrip-row.info")!;
    expect(row.textContent).toContain("Elven Lineage");
    expect(row.querySelectorAll(".pc-bchoice-chip").length).toBe(0);
  });
});

describe("domainPill", () => {
  it("maps kinds deterministically", () => {
    expect(domainPill(item({}))).toBe("Lineage");
    expect(domainPill(item({ choice: { kind: "select-inline", id: "spellcasting-ability", count: 1, options: [] } as never }))).toBe("Ability");
    expect(domainPill(item({ choice: { kind: "ability-points", id: "abilities", points: 3, max_per: 2, pool: [] } as never }))).toBe("Ability");
    expect(domainPill(item({ choice: { kind: "select-proficiency", id: "skill", count: 1, domain: "skill", from: [] } as never }))).toBe("Skill");
    expect(domainPill(item({ choice: { kind: "select-proficiency", id: "languages", count: 2, domain: "language" } as never }))).toBe("Lang");
    expect(domainPill(item({ choice: { kind: "select-entity", id: "feat", count: 1, entity_type: "feat" } as never }))).toBe("Feat");
    expect(domainPill(item({ choice: { kind: "select-inline", id: "", count: 1, options: [] } as never }))).toBe("Pick");
  });
});
