import { describe, it, expect } from "vitest";
import { iconForEntity } from "../src/modules/pc/components/inventory/icon-mapping";
import type { ResolvedEquipped } from "../src/modules/pc/pc.types";

const eq = (entity: object | null, entityType: string | null = null): ResolvedEquipped =>
  ({ index: 0, entity: entity as never, entityType, entry: {} as never } as ResolvedEquipped);

describe("iconForEntity — fallthroughs", () => {
  it("returns 'package' for inline (null entity)", () => {
    expect(iconForEntity(eq(null), { item: "rope" } as never)).toBe("package");
  });

  it("falls back to 'sword' for a weapon with no slug", () => {
    expect(iconForEntity(eq({ name: "Mystery Blade" }, "weapon"), { item: "x" } as never))
      .toBe("sword");
  });

  it("falls back to 'shield' for an armor with no category", () => {
    expect(iconForEntity(eq({ name: "Plate" }, "armor"), { item: "[[plate]]" } as never)).toBe("shield");
  });

  it("falls back to 'package' for unknown item types", () => {
    expect(iconForEntity(eq({ type: "nonsense" }, "item"), { item: "x" } as never))
      .toBe("package");
  });
});

describe("iconForEntity — weapon slug discrimination", () => {
  const w = (slug: string) => iconForEntity(eq({ slug }, "weapon"), { item: "x" } as never);

  it("dispatches axes (axe / battleaxe / handaxe / glaive / halberd)", () => {
    expect(w("battleaxe")).toBe("axe");
    expect(w("greataxe")).toBe("axe");
    expect(w("handaxe")).toBe("axe");
    expect(w("glaive")).toBe("axe");
    expect(w("halberd")).toBe("axe");
  });

  it("dispatches bows (longbow, shortbow) but NOT crossbow", () => {
    expect(w("longbow")).toBe("bow");
    expect(w("shortbow")).toBe("bow");
  });

  it("dispatches all crossbow variants to 'crossbow' (not 'bow')", () => {
    expect(w("crossbow-light")).toBe("crossbow");
    expect(w("crossbow-heavy")).toBe("crossbow");
    expect(w("crossbow-hand")).toBe("crossbow");
  });

  it("dispatches daggers / dart / sickle", () => {
    expect(w("dagger")).toBe("dagger");
    expect(w("dart")).toBe("dagger");
    expect(w("sickle")).toBe("dagger");
  });

  it("dispatches hammers (warhammer / maul / light-hammer)", () => {
    expect(w("warhammer")).toBe("hammer");
    expect(w("maul")).toBe("hammer");
    expect(w("light-hammer")).toBe("hammer");
  });

  it("dispatches mace-class weapons (mace / morningstar / flail / club / greatclub / quarterstaff / war-pick)", () => {
    expect(w("mace")).toBe("mace");
    expect(w("morningstar")).toBe("mace");
    expect(w("flail")).toBe("mace");
    expect(w("club")).toBe("mace");
    expect(w("greatclub")).toBe("mace");
    expect(w("quarterstaff")).toBe("mace");
    expect(w("war-pick")).toBe("mace");
  });

  it("dispatches spears (spear / pike / javelin / lance / trident)", () => {
    expect(w("spear")).toBe("spear");
    expect(w("pike")).toBe("spear");
    expect(w("javelin")).toBe("spear");
    expect(w("lance")).toBe("spear");
    expect(w("trident")).toBe("spear");
  });

  it("dispatches whip", () => {
    expect(w("whip")).toBe("whip");
  });

  it("dispatches net / sling / blowgun to 'bow-thrown'", () => {
    expect(w("net")).toBe("bow-thrown");
    expect(w("sling")).toBe("bow-thrown");
    expect(w("blowgun")).toBe("bow-thrown");
  });

  it("defaults to 'sword' for swords (longsword, shortsword, greatsword, scimitar, rapier)", () => {
    expect(w("longsword")).toBe("sword");
    expect(w("shortsword")).toBe("sword");
    expect(w("greatsword")).toBe("sword");
    expect(w("scimitar")).toBe("sword");
    expect(w("rapier")).toBe("sword");
  });

  it("matches case-insensitively on slug", () => {
    expect(w("Battleaxe")).toBe("axe");
    expect(w("LONGBOW")).toBe("bow");
  });
});

describe("iconForEntity — armor category discrimination", () => {
  const a = (category: string) => iconForEntity(eq({ category }, "armor"), { item: "x" } as never);

  it("dispatches by SRD-style category ('Light Armor' / 'Heavy Armor' / 'Shield')", () => {
    expect(a("Light Armor")).toBe("leather");
    expect(a("Medium Armor")).toBe("chain-mail");
    expect(a("Heavy Armor")).toBe("breastplate");
    expect(a("Shield")).toBe("shield");
  });

  it("dispatches by canonical lowercase category", () => {
    expect(a("light")).toBe("leather");
    expect(a("medium")).toBe("chain-mail");
    expect(a("heavy")).toBe("breastplate");
    expect(a("shield")).toBe("shield");
  });

  it("falls back to 'shield' for unrecognized categories", () => {
    expect(a("natural")).toBe("shield");
    expect(a("class feature")).toBe("shield");
  });
});

describe("iconForEntity — item.type dispatch", () => {
  const t = (type: string) => ({ type });

  it("dispatches simple item types to fitting icons", () => {
    expect(iconForEntity(eq(t("ring"),     "item"), { item: "x" } as never)).toBe("ring");
    expect(iconForEntity(eq(t("potion"),   "item"), { item: "x" } as never)).toBe("flask-conical");
    expect(iconForEntity(eq(t("scroll"),   "item"), { item: "x" } as never)).toBe("scroll");
    expect(iconForEntity(eq(t("wand"),     "item"), { item: "x" } as never)).toBe("wand");
    expect(iconForEntity(eq(t("staff"),    "item"), { item: "x" } as never)).toBe("staff");
    expect(iconForEntity(eq(t("rod"),      "item"), { item: "x" } as never)).toBe("rod");
    expect(iconForEntity(eq(t("amulet"),   "item"), { item: "x" } as never)).toBe("amulet");
    expect(iconForEntity(eq(t("cloak"),    "item"), { item: "x" } as never)).toBe("cloak");
    expect(iconForEntity(eq(t("tool"),     "item"), { item: "x" } as never)).toBe("wrench");
    expect(iconForEntity(eq(t("tools"),    "item"), { item: "x" } as never)).toBe("wrench");
  });

  it("matches case-insensitively on item.type", () => {
    expect(iconForEntity(eq(t("RING"), "item"), { item: "x" } as never)).toBe("ring");
    expect(iconForEntity(eq(t("Potion"), "item"), { item: "x" } as never)).toBe("flask-conical");
  });

  it("normalizes 'Wondrous item' (parenthetical-free trailing 'item') to 'sparkles'", () => {
    expect(iconForEntity(eq(t("Wondrous item"), "item"), { item: "x" } as never)).toBe("sparkles");
    expect(iconForEntity(eq(t("wondrous item"), "item"), { item: "x" } as never)).toBe("sparkles");
    expect(iconForEntity(eq(t("wondrous"), "item"), { item: "x" } as never)).toBe("sparkles");
  });

  it("routes SRD parenthetical 'Weapon (any sword)' through the weapon helper", () => {
    expect(iconForEntity(eq(t("Weapon (any sword)"), "item"), { item: "x" } as never)).toBe("sword");
    expect(iconForEntity(eq(t("Weapon (longsword)"), "item"), { item: "x" } as never)).toBe("sword");
    expect(iconForEntity(eq(t("Weapon (longbow)"), "item"), { item: "x" } as never)).toBe("bow");
    expect(iconForEntity(eq(t("Weapon (warhammer)"), "item"), { item: "x" } as never)).toBe("hammer");
    expect(iconForEntity(eq(t("Weapon (any axe)"), "item"), { item: "x" } as never)).toBe("axe");
    expect(iconForEntity(eq(t("Weapon (mace)"), "item"), { item: "x" } as never)).toBe("mace");
    expect(iconForEntity(eq(t("Weapon (dagger)"), "item"), { item: "x" } as never)).toBe("dagger");
  });

  it("routes SRD parenthetical 'Armor (chain shirt)' through the armor helper", () => {
    // "chain shirt" itself doesn't match the canonical category vocabulary,
    // so it falls through to the default 'shield'. The IMPORTANT property is
    // that the routing happens, not that every parenthetical resolves
    // perfectly: 'Armor (light)' should land on 'leather'.
    expect(iconForEntity(eq(t("Armor (light)"), "item"), { item: "x" } as never)).toBe("leather");
    expect(iconForEntity(eq(t("Armor (medium or heavy)"), "item"), { item: "x" } as never)).toBe("shield"); // ambiguous → default
    expect(iconForEntity(eq(t("Armor (shield)"), "item"), { item: "x" } as never)).toBe("shield");
  });
});
