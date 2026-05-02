/** @vitest-environment jsdom */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

vi.mock("obsidian", () => ({
  MarkdownRenderer: {
    render: async (_app: unknown, md: string, parent: HTMLElement) => {
      const doc = parent.ownerDocument;
      const p = doc.createElement("p");
      p.textContent = md;
      parent.appendChild(p);
    },
  },
  setIcon: vi.fn(),
  Component: class {},
}));

import { renderItemBlock } from "../src/modules/item/item.renderer";

beforeEach(() => {
  document.body.replaceChildren();
});

describe("renderItemBlock — formatAttunement structured form (Bug A)", () => {
  it("formats canonical structured attunement { required: true } as Required", async () => {
    const root = mountContainer();
    const card = await renderItemBlock({
      name: "Bracers of Defense",
      type: "Wondrous item",
      rarity: "rare",
      attunement: { required: true },
    } as never);
    root.appendChild(card);

    const attunementValue = root.querySelector(".archivist-item-properties")?.textContent ?? "";
    expect(attunementValue).toMatch(/Attunement:.*\bRequired\b/);
    expect(attunementValue).not.toMatch(/Not Required/);
  });

  it("formats { required: false } as Not Required", async () => {
    const root = mountContainer();
    const card = await renderItemBlock({
      name: "Bag of Holding",
      type: "Wondrous item",
      rarity: "uncommon",
      attunement: { required: false },
    } as never);
    root.appendChild(card);

    const text = root.querySelector(".archivist-item-properties")?.textContent ?? "";
    expect(text).toMatch(/Attunement:.*Not Required/);
  });

  it("formats { required: true, restriction: 'by a wizard' } showing the restriction", async () => {
    const root = mountContainer();
    const card = await renderItemBlock({
      name: "Robe of the Archmagi",
      type: "Wondrous item",
      rarity: "legendary",
      attunement: { required: true, restriction: "by a wizard" },
    } as never);
    root.appendChild(card);

    const text = root.querySelector(".archivist-item-properties")?.textContent ?? "";
    // Either "Required (by a wizard)" or just contains "by a wizard" in the value
    expect(text).toMatch(/Attunement:.*(\bRequired\b.*by a wizard|by a wizard)/i);
  });
});

describe("renderItemBlock — mechanical summary hidden from card (Bug B)", () => {
  it("does NOT render the mechanical summary section in the item card", async () => {
    const root = mountContainer();
    const card = await renderItemBlock({
      name: "Bracers of Defense",
      type: "Wondrous item",
      rarity: "rare",
      attunement: { required: true },
      bonuses: { ac: 2 },
      tier: "major",
    } as never);
    root.appendChild(card);

    // Summary section must NOT be present in the rendered card
    expect(root.querySelector(".archivist-item-summary")).toBeNull();
    // The bonus value must NOT appear as visible text in the card
    expect(root.textContent ?? "").not.toMatch(/AC \+2/);
  });
});
