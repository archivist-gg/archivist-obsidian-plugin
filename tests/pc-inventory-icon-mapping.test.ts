import { describe, it, expect } from "vitest";
import { iconForEntity } from "../src/modules/pc/components/inventory/icon-mapping";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

const eq = (entity: object | null, type?: string): ResolvedEquipped =>
  ({ index: 0, entity: entity as never, entry: {} as never } as ResolvedEquipped);

describe("iconForEntity", () => {
  it("returns 'package' for inline (null entity)", () => {
    expect(iconForEntity(eq(null), { item: "rope" } as never)).toBe("package");
  });

  it("returns 'sword' for weapons", () => {
    const w = { name: "Longsword", entityType: "weapon" };
    expect(iconForEntity(eq(w), { item: "[[longsword]]" } as never)).toBe("sword");
  });

  it("returns 'shield' for armor", () => {
    const a = { name: "Plate", entityType: "armor" };
    expect(iconForEntity(eq(a), { item: "[[plate]]" } as never)).toBe("shield");
  });

  it("dispatches item.type to a fitting icon", () => {
    const t = (type: string) => ({ entityType: "item", type });
    expect(iconForEntity(eq(t("ring")),     { item: "x" } as never)).toBe("tabler-ring");
    expect(iconForEntity(eq(t("potion")),   { item: "x" } as never)).toBe("flask-conical");
    expect(iconForEntity(eq(t("scroll")),   { item: "x" } as never)).toBe("scroll");
    expect(iconForEntity(eq(t("wand")),     { item: "x" } as never)).toBe("tabler-wand");
    expect(iconForEntity(eq(t("staff")),    { item: "x" } as never)).toBe("tabler-wand");
    expect(iconForEntity(eq(t("cloak")),    { item: "x" } as never)).toBe("shirt");
    expect(iconForEntity(eq(t("tool")),     { item: "x" } as never)).toBe("wrench");
    expect(iconForEntity(eq(t("wondrous")), { item: "x" } as never)).toBe("sparkles");
  });

  it("falls back to 'package' for unknown item types", () => {
    expect(iconForEntity(eq({ entityType: "item", type: "nonsense" }), { item: "x" } as never))
      .toBe("package");
  });

  it("matches case-insensitively on item.type", () => {
    expect(iconForEntity(eq({ entityType: "item", type: "RING" }), { item: "x" } as never))
      .toBe("tabler-ring");
  });
});
