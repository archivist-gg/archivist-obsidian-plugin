/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderFeatBlock } from "../packages/obsidian/src/modules/feat/feat.renderer";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { FeatEntity } from "@archivist-gg/dnd5e/feat/feat.types";

/**
 * R4-G3a §10.2.3 · the feat note's "Action:" line.
 *
 * SRD 2024 Boon of the Night Spirit declares an ENTITY-level `action_cost: bonus-action`; until now
 * the feat note showed nothing for it. The label comes from the ONE action-cost table in
 * `shared/rendering/action-cost-label.ts` (§4.2.4), never a further copy of the vocabulary.
 */
beforeAll(() => installObsidianDomHelpers());

const baseFeat = {
  slug: "srd-2024_feat_boon-of-the-night-spirit", name: "Boon of the Night Spirit",
  edition: "2024", source: "SRD 5.2", category: "epic-boon", description: "You gain the Boon.",
  prerequisites: [], benefits: [], effects: [], grants_asi: null, repeatable: false, choices: [],
} as unknown as FeatEntity;

/** The label/value pairs of the block's icon-property lines. */
function propertyLines(root: HTMLElement): { label: string; value: string }[] {
  return Array.from(root.querySelectorAll(".spell-properties .archivist-property-line-icon"))
    .map((line) => ({
      label: line.querySelector(".archivist-property-label")?.textContent ?? "",
      value: line.querySelector(".archivist-property-value")?.textContent ?? "",
    }));
}

describe("renderFeatBlock · the Action property line (§10.2.3)", () => {
  it("renders an entity-level action_cost as `Action: Bonus`", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock({ ...baseFeat, action_cost: "bonus-action" } as unknown as FeatEntity));
    expect(propertyLines(root)).toEqual([{ label: "Action:", value: "Bonus" }]);
  });

  it("uses the shared cost table for the other costs too (`action` → `Action`)", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock({ ...baseFeat, action_cost: "action" } as unknown as FeatEntity));
    expect(propertyLines(root)).toEqual([{ label: "Action:", value: "Action" }]);
  });

  it("renders NO Action line for a feat without an action_cost", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock(baseFeat));
    expect(propertyLines(root).some((p) => p.label === "Action:")).toBe(false);
    expect(root.textContent).not.toContain("Action:");
  });

  it("sits beside Prerequisites and Repeatable rather than replacing them", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock({
      ...baseFeat,
      prerequisites: [{ kind: "level", min: 19 }],
      repeatable: true,
      action_cost: "reaction",
    } as unknown as FeatEntity));
    expect(propertyLines(root)).toEqual([
      { label: "Prerequisites:", value: "Level 19+" },
      { label: "Repeatable:", value: "Yes" },
      { label: "Action:", value: "Reaction" },
    ]);
  });
});
