import { describe, it, expect, vi } from "vitest";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import {
  buildIdentifyCandidates,
  openIdentifyPicker,
} from "../packages/obsidian/src/modules/pc/components/inventory/identify-item-picker";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

// Capture DecisionPickModal construction so we can assert the opts + drive the
// writeValue callback without opening a real Obsidian modal.
const opened = vi.hoisted(() => ({
  calls: [] as Array<{ opts: { title: string; need: number; candidates: Array<{ slug: string }>; writeValue: (v: string[]) => void } }>,
}));
vi.mock("../packages/obsidian/src/modules/pc/components/builder/decision-modal", () => ({
  DecisionPickModal: class {
    constructor(
      _app: unknown,
      _ctx: unknown,
      public opts: { title: string; need: number; candidates: Array<{ slug: string }>; writeValue: (v: string[]) => void },
    ) {
      opened.calls.push({ opts });
    }
    open(): void {}
  },
}));

const reg = () =>
  buildMockRegistry([
    { slug: "potion-of-healing", entityType: "item", name: "Potion of Healing", data: { name: "Potion of Healing", type: "potion" } },
    { slug: "oil-of-sharpness", entityType: "item", name: "Oil of Sharpness", data: { name: "Oil of Sharpness", type: "potion" } },
    { slug: "ring-of-x", entityType: "item", name: "Ring of X", data: { name: "Ring of X", type: "ring" } },
    { slug: "longsword", entityType: "weapon", name: "Longsword", data: { name: "Longsword" } },
    { slug: "plate", entityType: "armor", name: "Plate", data: { name: "Plate" } },
    { slug: "unidentified-potion", entityType: "item", name: "Unidentified Potion", data: { name: "Unidentified Potion", type: "potion", unidentified: true, masked_category: "potion" } },
  ]);

describe("buildIdentifyCandidates", () => {
  it("scopes to the masked_category by item type, excluding unidentified placeholders", () => {
    const slugs = buildIdentifyCandidates(reg(), "potion").map((c) => c.slug).sort();
    expect(slugs).toEqual(["oil-of-sharpness", "potion-of-healing"]);
    expect(slugs).not.toContain("unidentified-potion"); // the placeholder itself is excluded
    expect(slugs).not.toContain("ring-of-x"); // wrong category
    expect(slugs).not.toContain("longsword"); // wrong category
  });

  it("scopes weapons/armor by entity type (non-empty for those categories)", () => {
    expect(buildIdentifyCandidates(reg(), "weapon").map((c) => c.slug)).toEqual(["longsword"]);
    expect(buildIdentifyCandidates(reg(), "armor").map((c) => c.slug)).toEqual(["plate"]);
  });

  it("is case-insensitive on the masked_category label", () => {
    expect(buildIdentifyCandidates(reg(), "Potion").map((c) => c.slug).sort()).toEqual([
      "oil-of-sharpness",
      "potion-of-healing",
    ]);
  });
});

describe("openIdentifyPicker", () => {
  const ctx = (identifyItem: ReturnType<typeof vi.fn>): ComponentRenderContext =>
    ({ app: {}, services: { entities: reg() }, editState: { identifyItem } }) as unknown as ComponentRenderContext;

  it("opens DecisionPickModal with need:1 and category-scoped item candidates (title uses a middot separator)", () => {
    opened.calls.length = 0;
    openIdentifyPicker(ctx(vi.fn()), 5, "potion");
    expect(opened.calls).toHaveLength(1);
    const { opts } = opened.calls[0];
    expect(opts.need).toBe(1);
    expect(opts.candidates.map((c) => c.slug).sort()).toEqual(["oil-of-sharpness", "potion-of-healing"]);
    // Title separator is the middot (`·`); the exact string carries no long dash.
    expect(opts.title).toBe("Identify item · choose a potion");
  });

  it("picking a candidate calls identifyItem(entryIndex, slug)", () => {
    opened.calls.length = 0;
    const identifyItem = vi.fn();
    openIdentifyPicker(ctx(identifyItem), 5, "potion");
    opened.calls[0].opts.writeValue(["potion-of-healing"]);
    expect(identifyItem).toHaveBeenCalledWith(5, "potion-of-healing");
  });

  it("no-op (no modal) when editState is absent", () => {
    opened.calls.length = 0;
    const noEdit = { app: {}, services: { entities: reg() }, editState: null } as unknown as ComponentRenderContext;
    openIdentifyPicker(noEdit, 5, "potion");
    expect(opened.calls).toHaveLength(0);
  });
});
