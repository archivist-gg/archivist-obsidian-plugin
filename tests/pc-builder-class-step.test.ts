/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { BuilderView } from "../src/modules/pc/components/builder-view";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const fighter: RegisteredEntity = {
  slug: "srd-5e_fighter", name: "Fighter", entityType: "class", filePath: "fighter.md",
  data: { name: "Fighter", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
};
const wizard: RegisteredEntity = {
  slug: "srd-5e_wizard", name: "Wizard", entityType: "class", filePath: "wizard.md",
  data: { name: "Wizard", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
};
// Subclass whose parent_class resolves to a class that IS in the registry.
const champion: RegisteredEntity = {
  slug: "srd-5e_champion", name: "Champion", entityType: "subclass", filePath: "champion.md",
  data: { name: "Champion", edition: "2014", parent_class: "[[SRD 5e/Classes/Fighter]]" },
  compendium: "SRD 5e", readonly: true, homebrew: false,
};
// Subclass whose parent_class resolves to a class that is NOT in the registry.
const orphanSub: RegisteredEntity = {
  slug: "hb_bladesong", name: "Bladesong", entityType: "subclass", filePath: "bladesong.md",
  data: { name: "Bladesong", edition: "2014", parent_class: "[[Homebrew/Classes/Swordmage]]" },
  compendium: "Homebrew", readonly: false, homebrew: true,
};
// Homebrew class whose display name ≠ slug: the engine's parent_class==="self"
// filter keys on bareEntitySlug(slug) ("crimson-order"), so a subclass linking
// the slug is offered fine — the orphan callout must NOT false-positive here.
const crimsonOrder: RegisteredEntity = {
  slug: "homebrew_crimson-order", name: "The Crimson Order", entityType: "class", filePath: "crimson-order.md",
  data: { name: "The Crimson Order", edition: "2014" }, compendium: "Homebrew", readonly: false, homebrew: true,
};
const crimsonSub: RegisteredEntity = {
  slug: "homebrew_blood-knight", name: "Blood Knight", entityType: "subclass", filePath: "blood-knight.md",
  data: { name: "Blood Knight", edition: "2014", parent_class: "[[Homebrew/Classes/crimson-order]]" },
  compendium: "Homebrew", readonly: false, homebrew: true,
};

interface CoreOpts {
  classes?: RegisteredEntity[];
  subclasses?: RegisteredEntity[];
}

function makeCore(opts: CoreOpts = {}) {
  const classes = opts.classes ?? [fighter, wizard];
  const subclasses = opts.subclasses ?? [];
  const byType: Record<string, RegisteredEntity[]> = { class: classes, subclass: subclasses };
  return {
    plugin: {},
    entities: {
      search: (q: string, type: string) =>
        (byType[type] ?? []).filter((e) => e.name.toLowerCase().includes(q.toLowerCase())),
      getByTypeAndSlug: (type: string, slug: string) =>
        (byType[type] ?? []).find((e) => e.slug === slug),
    },
    compendiums: { getAll: () => [
      { name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" },
      { name: "Homebrew", description: "", readonly: false, homebrew: true, folderPath: "" },
    ] },
    modules: { getByEntityType: () => undefined },
  };
}

interface CtxOpts {
  classEntry?: { name: string; level: number };
  core?: CoreOpts;
  editState?: Partial<Record<string, unknown>>;
}

function ctx(opts: CtxOpts = {}): ComponentRenderContext {
  const classList = opts.classEntry
    ? [{ name: opts.classEntry.name, level: opts.classEntry.level, subclass: null, choices: {} }]
    : [];
  // resolved.classes mirrors the definition; the entity is resolved when a slug
  // is on the character (drives the ledger + level row).
  const resolvedClasses = opts.classEntry
    ? [{
        entity: { slug: "srd-5e_fighter", name: "Fighter", choices_by_level: {}, features_by_level: {} },
        level: opts.classEntry.level, subclass: null, choices: {},
      }]
    : [];
  return {
    resolved: {
      definition: { name: "Valeria", class: classList, origin_choices: {} },
      classes: resolvedClasses,
      race: null, background: null, feats: [], totalLevel: opts.classEntry?.level ?? 0,
      features: [], spells: [],
    },
    derived: { totalLevel: opts.classEntry?.level ?? 0, proficiencyBonus: 2, hp: { max: 0 }, ac: 10 },
    editState: opts.editState ?? null,
    builderUiState: new Map(),
    activeStepId: "class",
    core: makeCore(opts.core),
  } as unknown as ComponentRenderContext;
}

describe("BuilderView class step (Task 17)", () => {
  it("shows the class entity-picker when no class is on the character", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    expect(root.querySelector(".pc-bpicker")).not.toBeNull();
    // Two class candidates → two seal rows; no level row yet.
    expect(root.querySelectorAll(".pc-btable-row").length).toBe(2);
    expect(root.querySelector(".pc-bclass-level")).toBeNull();
  });

  it("addClass fires when a class seal is clicked and no class is present", () => {
    const root = mountContainer();
    const addClass = vi.fn();
    new BuilderView().render(root, ctx({ editState: { addClass } }));
    root.querySelector<HTMLElement>(".pc-btable-row .pc-btoggle.seal")!.click();
    expect(addClass).toHaveBeenCalledWith("srd-5e_fighter");
  });

  it("shows a 1–20 level dropdown with the current level selected, and the decision ledger", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx({ classEntry: { name: "[[srd-5e_fighter]]", level: 5 } }));
    const sel = root.querySelector<HTMLSelectElement>(".pc-bclass-level");
    expect(sel).not.toBeNull();
    expect(sel!.querySelectorAll("option").length).toBe(20);
    expect(sel!.value).toBe("5");
    expect(root.querySelector(".pc-bledger")).not.toBeNull();
  });

  it("changing the level dropdown calls setClassLevel(0, n)", () => {
    const root = mountContainer();
    const setClassLevel = vi.fn();
    new BuilderView().render(root, ctx({
      classEntry: { name: "[[srd-5e_fighter]]", level: 3 },
      editState: { setClassLevel },
    }));
    const sel = root.querySelector<HTMLSelectElement>(".pc-bclass-level")!;
    sel.value = "7";
    sel.dispatchEvent(new Event("change"));
    expect(setClassLevel).toHaveBeenCalledWith(0, 7);
  });

  it("replacing the class preserves the current level (removeClass + addClass)", () => {
    const root = mountContainer();
    const calls: string[] = [];
    const removeClass = vi.fn((i: number) => calls.push(`remove:${i}`));
    const addClass = vi.fn((slug: string, level?: number) => calls.push(`add:${slug}:${level}`));
    new BuilderView().render(root, ctx({
      classEntry: { name: "[[srd-5e_fighter]]", level: 5 },
      editState: { removeClass, addClass, setClassLevel: vi.fn() },
    }));
    // The Wizard row is the non-selected one; clicking its seal swaps the class.
    const rows = [...root.querySelectorAll<HTMLElement>(".pc-btable-row")];
    const wizardRow = rows.find((r) => r.querySelector(".pc-btable-name")?.textContent === "Wizard")!;
    wizardRow.querySelector<HTMLElement>(".pc-btoggle.seal")!.click();
    expect(removeClass).toHaveBeenCalledWith(0);
    expect(addClass).toHaveBeenCalledWith("srd-5e_wizard", 5);
    // remove must run before add (so index 0 is the slot being replaced).
    expect(calls).toEqual(["remove:0", "add:srd-5e_wizard:5"]);
  });

  it("clicking the already-selected class does not wipe choices (no removeClass/addClass)", () => {
    // The entity-picker suppresses a same-slug reselect (the current seal is
    // inert), so clicking the Fighter row when Fighter is already selected must
    // not fire removeClass/addClass — that pins the no-choice-wipe guarantee at
    // the class-step layer.
    const root = mountContainer();
    const removeClass = vi.fn();
    const addClass = vi.fn();
    new BuilderView().render(root, ctx({
      classEntry: { name: "[[srd-5e_fighter]]", level: 5 },
      editState: { removeClass, addClass, setClassLevel: vi.fn() },
    }));
    // Fighter is the already-selected row; clicking its seal must be inert.
    const rows = [...root.querySelectorAll<HTMLElement>(".pc-btable-row")];
    const fighterRow = rows.find((r) => r.querySelector(".pc-btable-name")?.textContent === "Fighter")!;
    fighterRow.querySelector<HTMLElement>(".pc-btoggle.seal")!.click();
    expect(removeClass).not.toHaveBeenCalled();
    expect(addClass).not.toHaveBeenCalled();
  });

  it("emits an orphan callout naming the subclass and the missing class", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx({
      core: { classes: [fighter], subclasses: [orphanSub] },
    }));
    const orphan = root.querySelector(".pc-bclass-orphan");
    expect(orphan).not.toBeNull();
    expect(orphan!.textContent).toContain("Bladesong");
    expect(orphan!.textContent).toContain("swordmage");
  });

  it("emits no orphan callout when every subclass parent_class resolves to a class", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx({
      core: { classes: [fighter], subclasses: [champion] },
    }));
    expect(root.querySelector(".pc-bclass-orphan")).toBeNull();
  });

  it("emits no orphan callout when a homebrew subclass links the class slug (name ≠ slug)", () => {
    // The engine offers Blood Knight (parent_class slug "crimson-order" matches
    // bareEntitySlug("homebrew_crimson-order")), so the callout must key on the
    // entity slug too — a name-only set ("the-crimson-order") would false-positive.
    const root = mountContainer();
    new BuilderView().render(root, ctx({
      core: { classes: [crimsonOrder], subclasses: [crimsonSub] },
    }));
    expect(root.querySelector(".pc-bclass-orphan")).toBeNull();
  });
});
