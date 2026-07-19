/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderDecisionStrip, domainPill } from "../packages/obsidian/src/modules/pc/components/builder/decision-strip";
import { isBackgroundStripItem } from "../packages/obsidian/src/modules/pc/components/builder/background-step";
import type { DecisionItem } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

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
  ({ resolved: { definition: {} }, derived: {}, services: { entities: {} }, editState, builderUiState: new Map() }) as unknown as ComponentRenderContext;

/** An origin-feat's OWN choice (e.g. a Magic Initiate spell pick). The dnd5e
 *  decision engine surfaces these into ledger.origin with source.kind "feat" and
 *  a "feat:<childId>" key (buildItem keyPrefix "feat:"). The builder must route
 *  the write to the ORIGIN namespace as "background:feat:<childId>" (exactly what
 *  the resolver's feat-spell pass reads via originRead("background")), NEVER via
 *  the class-slot setChoice path. */
const featOriginItem = (over: Partial<DecisionItem> = {}): DecisionItem =>
  item({
    key: "feat:magic-initiate-cleric-spell",
    source: { kind: "feat", slug: "srd-2024_magic-initiate-cleric" } as never,
    level: 0,
    featureName: "Magic Initiate (Cleric)",
    choice: { kind: "select-inline", id: "magic-initiate-cleric-spell", count: 1, options: [] } as never,
    options: [
      { value: "guidance", label: "Guidance" },
      { value: "light", label: "Light" },
    ],
    selected: undefined,
    status: "unresolved",
    ...over,
  });

const clickChip = (root: ParentNode, text: string): void => {
  const chip = [...root.querySelectorAll(".pc-bchoice-chip")].find((ch) =>
    ch.textContent!.includes(text),
  ) as HTMLElement;
  chip.click();
};

describe("decision-strip writeValue routing across feature sources", () => {
  // ── the new feat-source branch (Magic Initiate origin-feat picker) ──
  it("routes an origin-feat MI child pick to setOriginChoice under background:feat:<id>, never setChoice", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const setChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setOriginChoice, setChoice }), {
      items: [featOriginItem()], pill: domainPill, live: true, stateKey: "t",
    });
    clickChip(c, "Guidance");
    expect(setOriginChoice).toHaveBeenCalledWith("background:feat:magic-initiate-cleric-spell", "guidance");
    expect(setChoice).not.toHaveBeenCalled();
  });

  // ── regressions: every existing source routes unchanged ──
  it("regression: a race pick still routes through setOriginChoice(race:<key>)", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const setChoice = vi.fn();
    renderDecisionStrip(c, mkCtx({ setOriginChoice, setChoice }), {
      items: [item({})], pill: domainPill, live: true, stateKey: "t",
    });
    clickChip(c, "Drow");
    expect(setOriginChoice).toHaveBeenCalledWith("race:elven-lineage", "drow");
    expect(setChoice).not.toHaveBeenCalled();
  });

  it("regression: a background pick still routes through setOriginChoice(background:<key>)", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const setChoice = vi.fn();
    const bgItem = item({
      key: "tool-choice", source: { kind: "background" } as never,
      featureName: "Tool Proficiency",
      choice: { kind: "select-inline", id: "tool-choice", count: 1, options: [] } as never,
      options: [
        { value: "smiths-tools", label: "Smith's Tools" },
        { value: "carpenters-tools", label: "Carpenter's Tools" },
      ],
      selected: undefined, status: "unresolved",
    });
    renderDecisionStrip(c, mkCtx({ setOriginChoice, setChoice }), {
      items: [bgItem], pill: domainPill, live: true, stateKey: "t",
    });
    clickChip(c, "Smith's Tools");
    expect(setOriginChoice).toHaveBeenCalledWith("background:tool-choice", "smiths-tools");
    expect(setChoice).not.toHaveBeenCalled();
  });

  it("regression: a class-slot pick still routes through setChoice(classIndex, level, key, value)", () => {
    const c = mountContainer();
    const setOriginChoice = vi.fn();
    const setChoice = vi.fn();
    const classItem = item({
      key: "fighting-style", source: { kind: "class" } as never, level: 1,
      featureName: "Fighting Style",
      choice: { kind: "select-inline", id: "fighting-style", count: 1, options: [] } as never,
      options: [
        { value: "defense", label: "Defense" },
        { value: "dueling", label: "Dueling" },
      ],
      selected: undefined, status: "unresolved",
    });
    renderDecisionStrip(c, mkCtx({ setOriginChoice, setChoice }), {
      items: [classItem], pill: (i) => `L${i.level}`, live: true, classIndex: 2, stateKey: "t",
    });
    clickChip(c, "Defense");
    expect(setChoice).toHaveBeenCalledWith(2, 1, "fighting-style", "defense");
    expect(setOriginChoice).not.toHaveBeenCalled();
  });
});

describe("background-step origin filter widening", () => {
  it("surfaces both background-source AND feat-source origin items, excluding race", () => {
    const bg = item({ source: { kind: "background" } as never, key: "abilities" });
    const feat = featOriginItem();
    const race = item({ source: { kind: "race" } as never, key: "elven-lineage" });
    const filtered = [bg, feat, race].filter(isBackgroundStripItem);
    expect(filtered).toContain(bg);
    expect(filtered).toContain(feat); // the widening: feat-source now surfaces here
    expect(filtered).not.toContain(race); // race items belong to the race step
  });
});
