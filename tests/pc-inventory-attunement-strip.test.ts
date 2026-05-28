/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";

// Inject an <svg> child when setIcon is called so medallion glyphs render.
vi.mock("obsidian", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("obsidian");
  return {
    ...actual,
    setIcon: (el: HTMLElement, name: string) => {
      el.setAttribute("data-icon", name);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      el.appendChild(svg);
    },
  };
});

import { AttunementStrip } from "../src/modules/pc/components/inventory/attunement-strip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctxWithAttuned(attuned: Array<{ name: string; rarity: string }>): ComponentRenderContext {
  const equipment = attuned.map((_it, i) => ({
    item: `[[item-${i}]]`,
    equipped: true,
    attuned: true,
  }));
  return {
    resolved: { definition: { equipment } } as never,
    derived: { attunementUsed: attuned.length, attunementLimit: 3 } as never,
    core: {
      entities: {
        getBySlug: (slug: string) => {
          const idx = Number(slug.split("-")[1]);
          return { entityType: "item", data: { name: attuned[idx].name, rarity: attuned[idx].rarity } };
        },
      },
    } as never,
    app: {} as never,
    editState: null,
  };
}

describe("AttunementStrip — redesigned", () => {
  it("renders 'ATTUNED' crimson label and N/M count", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Cloak", rarity: "uncommon" }]));
    expect(root.querySelector(".pc-attune-label")?.textContent?.toLowerCase()).toContain("attuned");
    expect(root.querySelector(".pc-attune-count")?.textContent).toMatch(/1.*\/\s*3/);
  });

  it("renders one medallion-cell per limit slot, with item name below", () => {
    const root = mountContainer();
    new AttunementStrip().render(
      root,
      ctxWithAttuned([
        { name: "Cloak of Protection", rarity: "uncommon" },
        { name: "Ring of Mind Shielding", rarity: "uncommon" },
      ]),
    );
    const cells = root.querySelectorAll(".pc-medallion-wrapper");
    expect(cells.length).toBe(3);
    expect(cells[0].querySelector(".pc-medallion-name")?.textContent).toBe("Cloak of Protection");
    expect(cells[1].querySelector(".pc-medallion-name")?.textContent).toBe("Ring of Mind Shielding");
  });

  it("empty slots get class 'empty' on medallion + 'empty' label below", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Cloak", rarity: "uncommon" }]));
    const empties = root.querySelectorAll(".pc-medallion.empty");
    expect(empties.length).toBe(2);
  });

  it("medallion gets rarity-* class for border + glyph color", () => {
    const root = mountContainer();
    new AttunementStrip().render(root, ctxWithAttuned([{ name: "Wand", rarity: "very rare" }]));
    expect(root.querySelector(".pc-medallion.rarity-very-rare")).toBeTruthy();
  });
});
