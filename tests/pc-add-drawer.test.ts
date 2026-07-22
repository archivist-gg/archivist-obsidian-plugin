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

// Hidden-compendium filtering (R3-P6, F3). SpellCandidate carries no compendium,
// so the drawer re-derives it via the registry's slug lookup. All three spells
// satisfy classSpellCandidates' class/level gates (wizard, level <= maxLevel=3)
// so each becomes a candidate row; only the FILTER can then remove one.
const HIDDEN_REG = buildMockRegistry([
  { slug: "hidden-new", name: "Hidden New Spell", entityType: "spell", compendium: "SRD 5e", data: { name: "Hidden New Spell", level: 2, classes: ["wizard"] } },
  { slug: "visible-2024", name: "Visible Spell", entityType: "spell", compendium: "SRD 2024", data: { name: "Visible Spell", level: 2, classes: ["wizard"] } },
  { slug: "known-hidden", name: "Known Hidden Spell", entityType: "spell", compendium: "SRD 5e", data: { name: "Known Hidden Spell", level: 1, classes: ["wizard"] } },
]);

function ctxHidden(): ComponentRenderContext {
  return {
    // The known hidden spell is genuinely known via the class list (source not "item").
    resolved: { spells: [{ slug: "known-hidden", source: "class" }] } as never,
    derived: { spellcastingClasses: [{ classSlug: "wizard" }], derivedSpellSlots: { 3: 1 }, pactMagic: null } as never,
    services: { entities: HIDDEN_REG, plugin: { settings: { hiddenCompendiums: ["SRD 5e"] } } } as never,
    app: {} as never, editState: { addKnownSpell: vi.fn(), removeKnownSpell: vi.fn() } as never,
  };
}

describe("renderAddDrawer: hidden compendiums filtered, known-exempt (F3)", () => {
  it("hidden-compendium spells are absent from the add table; known ones stay (F3)", () => {
    const root = mountContainer();
    renderAddDrawer(root, ctxHidden());
    const names = [...root.querySelectorAll(".pc-add-name")].map((n) => n.textContent);
    expect(names).not.toContain("Hidden New Spell");   // hidden compendium, unknown: removed
    expect(names).toContain("Visible Spell");           // visible compendium: present
    expect(names).toContain("Known Hidden Spell");      // hidden compendium but known: exempt
  });
});
