import { describe, it, expect } from "vitest";
import { iconForEntity } from "../src/modules/pc/components/inventory/icon-mapping";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

const eq = (entity: object | null, entityType: string | null = null): ResolvedEquipped =>
  ({ index: 0, entity: entity as never, entityType, entry: {} as never } as ResolvedEquipped);

describe("iconForEntity", () => {
  it("returns 'package' for inline (null entity)", () => {
    expect(iconForEntity(eq(null), { item: "rope" } as never)).toBe("package");
  });

  it("returns 'sword' for weapons", () => {
    expect(iconForEntity(eq({ name: "Longsword" }, "weapon"), { item: "[[longsword]]" } as never)).toBe("sword");
  });

  it("returns 'shield' for armor", () => {
    expect(iconForEntity(eq({ name: "Plate" }, "armor"), { item: "[[plate]]" } as never)).toBe("shield");
  });

  it("dispatches item.type to a fitting icon", () => {
    const t = (type: string) => ({ type });
    expect(iconForEntity(eq(t("ring"),     "item"), { item: "x" } as never)).toBe("tabler-ring");
    expect(iconForEntity(eq(t("potion"),   "item"), { item: "x" } as never)).toBe("flask-conical");
    expect(iconForEntity(eq(t("scroll"),   "item"), { item: "x" } as never)).toBe("scroll");
    expect(iconForEntity(eq(t("wand"),     "item"), { item: "x" } as never)).toBe("tabler-wand");
    expect(iconForEntity(eq(t("staff"),    "item"), { item: "x" } as never)).toBe("tabler-wand");
    expect(iconForEntity(eq(t("rod"),      "item"), { item: "x" } as never)).toBe("tabler-baseline");
    expect(iconForEntity(eq(t("amulet"),   "item"), { item: "x" } as never)).toBe("tabler-needle");
    expect(iconForEntity(eq(t("cloak"),    "item"), { item: "x" } as never)).toBe("shirt");
    expect(iconForEntity(eq(t("tool"),     "item"), { item: "x" } as never)).toBe("wrench");
    expect(iconForEntity(eq(t("tools"),    "item"), { item: "x" } as never)).toBe("wrench");
    expect(iconForEntity(eq(t("wondrous"), "item"), { item: "x" } as never)).toBe("sparkles");
  });

  it("falls back to 'package' for unknown item types", () => {
    expect(iconForEntity(eq({ type: "nonsense" }, "item"), { item: "x" } as never))
      .toBe("package");
  });

  it("matches case-insensitively on item.type", () => {
    expect(iconForEntity(eq({ type: "RING" }, "item"), { item: "x" } as never))
      .toBe("tabler-ring");
  });
});
