/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { renderAddDrawer } from "../packages/obsidian/src/modules/pc/components/spells/add-drawer";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

vi.mock("../packages/obsidian/src/modules/spell/spell.renderer", () => ({
  renderSpellBlock: vi.fn(() => Promise.resolve(document.createElement("div"))),
}));

beforeAll(() => installObsidianDomHelpers());

const REG = buildMockRegistry([
  { slug: "fireball", name: "Fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"] } },
  { slug: "cure-wounds", name: "Cure Wounds", entityType: "spell", data: { name: "Cure Wounds", level: 1, classes: ["cleric"] } },
]);

function ctx(addKnownSpell = vi.fn()): ComponentRenderContext {
  return {
    resolved: { spells: [] } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 3: 1 }, pactMagic: null } as never,
    services: { entities: REG } as never, app: {} as never, editState: { addKnownSpell, removeKnownSpell: vi.fn() } as never,
  };
}

describe("renderAddDrawer — class gating", () => {
  it("lists class candidates only and adds on ＋ click", () => {
    const root = mountContainer();
    const addKnownSpell = vi.fn();
    renderAddDrawer(root, ctx(addKnownSpell));
    const names = [...root.querySelectorAll(".pc-spell-add-table .pc-add-name")].map((n) => n.textContent);
    expect(names).toContain("Fireball");        // wizard class match
    expect(names).not.toContain("Cure Wounds");  // cleric, filtered out
    (root.querySelector(".pc-add-toggle") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(addKnownSpell).toHaveBeenCalledWith("fireball", { class: "wizard" });
  });
});

// Regression harness: a wizard whose class list includes all three candidate
// spells, but whose resolved.spells carry different `source` provenance.
const KNOWN_REG = buildMockRegistry([
  { slug: "magic-missile", name: "Magic Missile", entityType: "spell", data: { name: "Magic Missile", level: 1, classes: ["wizard"] } },
  { slug: "fireball", name: "Fireball", entityType: "spell", data: { name: "Fireball", level: 3, classes: ["wizard"] } },
  { slug: "detect-magic", name: "Detect Magic", entityType: "spell", data: { name: "Detect Magic", level: 1, classes: ["wizard"] } },
]);

type ResolvedSpell = { slug: string; source: "class" | "feat" | "item" };

function ctxKnown(
  resolvedSpells: ResolvedSpell[],
  editState = { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() },
): ComponentRenderContext {
  return {
    resolved: { spells: resolvedSpells } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 3: 1 }, pactMagic: null } as never,
    services: { entities: KNOWN_REG } as never, app: {} as never, editState: editState as never,
  };
}

function toggleFor(root: HTMLElement, name: string): HTMLButtonElement {
  const row = [...root.querySelectorAll(".pc-spell-add-row")].find(
    (r) => r.querySelector(".pc-add-name")?.textContent === name,
  );
  if (!row) throw new Error(`no add-drawer row for "${name}"`);
  return row.querySelector(".pc-add-toggle") as HTMLButtonElement;
}

describe("renderAddDrawer: known-set excludes scroll (source:item) spells (AC-S4)", () => {
  const resolved: ResolvedSpell[] = [
    { slug: "magic-missile", source: "class" }, // genuinely known via class list
    { slug: "fireball", source: "item" },        // scroll-granted only, NOT actually known
    { slug: "detect-magic", source: "feat" },    // feat-granted, legitimately known
  ];

  it("renders a scroll-only class spell as ADDABLE, not already-known", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxKnown(resolved));
    const fb = toggleFor(root, "Fireball");
    expect(fb.classList.contains("on")).toBe(false); // ＋ affordance, not ✓
  });

  it("still renders a class-known spell as known", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxKnown(resolved));
    expect(toggleFor(root, "Magic Missile").classList.contains("on")).toBe(true);
  });

  it("still renders a feat-granted spell as known (exclusion is item-only)", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxKnown(resolved));
    expect(toggleFor(root, "Detect Magic").classList.contains("on")).toBe(true);
  });

  it("clicking a scroll spell's toggle reaches addKnownSpell (not the no-op removeKnownSpell)", () => {
    const root = mountContainer();
    const editState = { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() };
    renderAddDrawer(root, ctxKnown(resolved, editState));
    toggleFor(root, "Fireball").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editState.addKnownSpell).toHaveBeenCalledWith("fireball", { class: "wizard" });
    expect(editState.removeKnownSpell).not.toHaveBeenCalled();
  });
});
