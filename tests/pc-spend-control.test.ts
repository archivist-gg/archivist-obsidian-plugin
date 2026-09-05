/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderSpendControl } from "../packages/obsidian/src/modules/pc/components/actions/spend-control";
import { resolveFeatureResources } from "@archivist-gg/dnd5e/pc/pc.resources";
import { __resetWarnOnceForTests } from "@archivist-gg/dnd5e/dnd/warn-once";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

const combatSuperiority = { feature: { id: "combat-superiority", name: "Combat Superiority", resources: [{ id: "fighter-2024:superiority-dice",
  name: "Superiority Dice", max_formula: "4", reset: "short-rest", die: { base: "d8", scaling: { "10": "d10" } } }] },
  source: { kind: "subclass", slug: "bm", level: 3 } };

function ctx(featureUses: Record<string, { used: number; max: number }>, spend = vi.fn()): ComponentRenderContext & { spend: typeof spend } {
  const resolved = { totalLevel: 3, classes: [{ entity: { slug: "fighter" }, level: 3, subclass: { slug: "bm" } }],
    features: [combatSuperiority], pools: [], state: { feature_uses: featureUses } };
  (resolved as { resources?: unknown }).resources = resolveFeatureResources([combatSuperiority as never]);
  return { resolved: resolved as never, derived: {} as never, services: {} as never, app: {} as never,
    editState: { spendFeatureUse: spend } as never, spend };
}

describe("renderSpendControl (R4-G4 §3.2.2)", () => {
  it("§3.3 (f) the absence rule: a present feature_uses key with an EMPTY index renders the raw id, no die label, no throw", () => {
    const host = mountContainer();
    const c = ctx({ seals: { used: 0, max: 3 } });
    (c.resolved as { resources?: unknown }).resources = new Map();
    renderSpendControl(host, { consumes: { resource: "seals", amount: 1 }, ctx: c });
    expect(host.querySelector<HTMLButtonElement>("button.pc-spend-control")!.textContent).toBe("Spend 1 seals");
  });
  it("RED FIRST: renders 'Spend 1 Superiority Dice (d8)' (the name VERBATIM, no singularization) and spends 1 on click", () => {
    const host = mountContainer();
    const c = ctx({ "fighter-2024:superiority-dice": { used: 0, max: 4 } });
    renderSpendControl(host, { consumes: { resource: "fighter-2024:superiority-dice", amount: 1 }, ctx: c });
    const btn = host.querySelector<HTMLButtonElement>("button.pc-spend-control")!;
    expect(btn.textContent).toBe("Spend 1 Superiority Dice (d8)");
    btn.click();
    expect(c.spend).toHaveBeenCalledWith("fighter-2024:superiority-dice", 1);
  });
  it("an absent owner renders NOTHING and warns once per id", () => {
    __resetWarnOnceForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = mountContainer();
    const c = ctx({});
    renderSpendControl(host, { consumes: { resource: "fighter:superiority-dice", amount: 1 }, ctx: c });
    renderSpendControl(host, { consumes: { resource: "fighter:superiority-dice", amount: 1 }, ctx: c });
    expect(host.querySelector("button")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it("disabled when max − used < amount; the amount is the consumes.amount", () => {
    const host = mountContainer();
    const c = ctx({ "fighter-2024:superiority-dice": { used: 3, max: 4 } });
    renderSpendControl(host, { consumes: { resource: "fighter-2024:superiority-dice", amount: 2 }, ctx: c });
    const btn = host.querySelector<HTMLButtonElement>("button.pc-spend-control")!;
    // m2's RED FIRST (Gate 2 M-18): force the click through and read the AMOUNT the writer receives
    btn.disabled = false;
    btn.click();
    expect(c.spend).toHaveBeenCalledWith("fighter-2024:superiority-dice", 2);
    expect(btn.textContent).toBe("Spend 2 Superiority Dice (d8)");
  });
  it("the button is disabled when max − used < amount", () => {
    const host = mountContainer();
    const c = ctx({ "fighter-2024:superiority-dice": { used: 3, max: 4 } });
    renderSpendControl(host, { consumes: { resource: "fighter-2024:superiority-dice", amount: 2 }, ctx: c });
    expect(host.querySelector<HTMLButtonElement>("button.pc-spend-control")!.disabled).toBe(true);
  });
  it("free_uses and expend_condition render as captions from the two tables", () => {
    const host = mountContainer();
    const c = ctx({ "fighter-2024:superiority-dice": { used: 0, max: 4 } });
    renderSpendControl(host, { consumes: { resource: "fighter-2024:superiority-dice", amount: 1,
      free_uses: { amount: 1, reset: "long-rest" }, expend_condition: "roll_fails" }, ctx: c });
    const caps = Array.from(host.querySelectorAll(".pc-spend-caption")).map((n) => n.textContent);
    expect(caps).toEqual(["1 free use / Long Rest", "spent only when the roll fails"]);
  });
});
