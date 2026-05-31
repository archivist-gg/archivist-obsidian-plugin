/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderAddDrawer } from "../src/modules/pc/components/spells/add-drawer";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

const REG = buildMockRegistry([
  { slug: "srd-5e_fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"], edition: "2014" } },
  { slug: "srd-2024_fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"], edition: "2024" } },
]);

function ctx(knownSlugs: string[], editState: object): ComponentRenderContext {
  return {
    resolved: { spells: knownSlugs.map((slug) => ({ slug, entity: {}, classSlug: "wizard", source: "class", prepared: false, alwaysPrepared: false })) } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 3: 1 }, pactMagic: null } as never,
    core: { entities: REG } as never, app: {} as never, editState: editState as never,
  };
}

describe("renderAddDrawer v2", () => {
  it("lists both editions with source tags (no dedup)", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx([], { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() }));
    const tags = [...root.querySelectorAll(".pc-spell-srctag")].map((t) => t.textContent);
    expect(tags).toContain("2014");
    expect(tags).toContain("2024");
  });

  it("＋ adds an unknown spell via addKnownSpell", () => {
    const root = mountContainer();
    const addKnownSpell = vi.fn();
    renderAddDrawer(root, ctx([], { addKnownSpell, removeKnownSpell: vi.fn() }));
    const btn = root.querySelector(".pc-add-toggle") as HTMLElement;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(addKnownSpell).toHaveBeenCalled();
  });

  it("a known spell shows the ✓ on-state and removes on click", () => {
    const root = mountContainer();
    const removeKnownSpell = vi.fn();
    renderAddDrawer(root, ctx(["srd-5e_fireball"], { addKnownSpell: vi.fn(), removeKnownSpell }));
    const onToggle = root.querySelector(".pc-add-toggle.on") as HTMLElement;
    expect(onToggle).not.toBeNull();
    onToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(removeKnownSpell).toHaveBeenCalledWith("srd-5e_fireball");
  });

  it("the Source filter narrows to one edition", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctx([], { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() }));
    const f2024 = [...root.querySelectorAll(".pc-spell-filter")].find((c) => c.textContent === "2024") as HTMLElement;
    f2024.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const tags = [...root.querySelectorAll(".pc-spell-srctag")].map((t) => t.textContent);
    expect(tags).toEqual(["2024"]);
  });
});

const REG_MULTI = buildMockRegistry([
  { slug: "srd-2024_fire-bolt", name: "Fire Bolt", entityType: "spell", data: { name: "Fire Bolt", level: 0, classes: ["wizard"], edition: "2024" } },
  { slug: "srd-2024_magic-missile", name: "Magic Missile", entityType: "spell", data: { name: "Magic Missile", level: 1, classes: ["wizard"], edition: "2024" } },
  { slug: "srd-2024_fireball", name: "Fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"], edition: "2024" } },
]);

function ctxMulti(): ComponentRenderContext {
  return {
    resolved: { spells: [] } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 1: 4, 2: 3, 3: 2 }, pactMagic: null } as never,
    core: { entities: REG_MULTI } as never, app: {} as never,
    editState: { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() } as never,
  };
}

describe("renderAddDrawer v2 — level grouping + filter", () => {
  it("groups candidates under per-level section headers (not a flat list)", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxMulti());
    const heads = [...root.querySelectorAll(".pc-add-section-head")].map((h) => h.textContent);
    expect(heads).toEqual(["Cantrips", "1st Level", "3rd Level"]);
  });

  it("renders a Level filter chip row that narrows the list to one level", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxMulti());
    const chips = [...root.querySelectorAll(".pc-add-levelbar .pc-spell-fchip")].map((c) => c.textContent);
    expect(chips).toContain("All");
    expect(chips).toContain("Cantrip");
    expect(chips).toContain("1st");
    const oneSt = [...root.querySelectorAll(".pc-add-levelbar .pc-spell-fchip")].find((c) => c.textContent === "1st") as HTMLElement;
    oneSt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect([...root.querySelectorAll(".pc-add-row-name")].map((n) => n.textContent)).toEqual(["Magic Missile"]);
    expect([...root.querySelectorAll(".pc-add-section-head")].map((h) => h.textContent)).toEqual(["1st Level"]);
  });
});
