/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderClassStep } from "../packages/obsidian/src/modules/pc/components/builder/class-step";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../packages/obsidian/src/shared/entities/entity-registry";
import type { ClassData } from "../packages/obsidian/src/modules/pc/components/builder/class-chronicle";

beforeAll(() => installObsidianDomHelpers());

const BARD_SKILLS = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history",
  "insight", "intimidation", "investigation", "medicine", "nature", "perception",
  "performance", "persuasion", "religion", "sleight-of-hand", "stealth", "survival",
];

/** Bard-shaped runtime entity with an L1 skill choice so buildDecisionLedger
 *  yields at least one decision item for classIndex 0 (the owned strip). */
function bardData(): ClassData {
  return {
    hit_die: "d8",
    primary_abilities: ["cha"],
    saving_throws: ["cha", "dex"],
    skill_choices: { count: 3, from: BARD_SKILLS },
    subclass_level: 3,
    subclass_feature_name: "Bard Subclass",
    features_by_level: {
      1: [{ id: "bardic-inspiration", name: "Bardic Inspiration", description: "You inspire others." }],
    },
    description: "An inspiring magician whose power echoes the music of creation.",
    source: "SRD 5.2",
    edition: "2024",
  };
}

function warlockData(): ClassData {
  return {
    hit_die: "d8",
    primary_abilities: ["cha"],
    saving_throws: ["wis", "cha"],
    features_by_level: {},
    description: "A wielder of magic derived from a bargain with an extraplanar entity.",
    source: "SRD 5.2",
    edition: "2024",
  };
}

function entityOf(slug: string, name: string, data: ClassData, type = "class"): RegisteredEntity {
  return {
    slug, name, entityType: type,
    filePath: `Compendium/Classes/${name}.md`,
    data: data as unknown as Record<string, unknown>,
    compendium: "SRD 5.2", readonly: true, homebrew: false,
  };
}

/** Minimal registry over a fixed entity list. */
function mkRegistry(entities: RegisteredEntity[]): {
  search: (q: string, type: string) => RegisteredEntity[];
  getByTypeAndSlug: (type: string, slug: string) => RegisteredEntity | undefined;
} {
  return {
    search: (q: string, type: string) =>
      entities.filter((e) => e.entityType === type && e.name.toLowerCase().includes(q.toLowerCase())),
    getByTypeAndSlug: (type: string, slug: string) =>
      entities.find((e) => e.entityType === type && e.slug === slug),
  };
}

interface CtxOverrides {
  setClassLevel?: ReturnType<typeof vi.fn>;
  removeClass?: ReturnType<typeof vi.fn>;
  addClass?: ReturnType<typeof vi.fn>;
}

function mkCtx(opts: {
  classEntries: Array<{ name: string; level: number; subclass?: string | null }>;
  entities: RegisteredEntity[];
  scores?: Record<string, number>;
  overrides?: CtxOverrides;
}): ComponentRenderContext {
  const registry = mkRegistry(opts.entities);
  const resolvedClasses = opts.classEntries.map((e) => {
    const slug = e.name.replace(/^\[\[/, "").replace(/\]\]$/, "");
    const entity = registry.getByTypeAndSlug("class", slug);
    // resolved.classes[i].entity is a ClassEntity (carries slug + skill_choices +
    // features_by_level), distinct from the RegisteredEntity.data ClassData blob
    // the chronicle renders from. Fold slug onto the data so buildDecisionLedger
    // can read it.
    return {
      entity: entity ? { slug, ...(entity.data as Record<string, unknown>) } : null,
      level: e.level,
      subclass: null,
      choices: {},
    };
  });
  return {
    app: {} as unknown,
    resolved: {
      definition: { class: opts.classEntries.map((e) => ({ subclass: null, ...e })) },
      classes: resolvedClasses,
      features: [],
      pools: [],
    },
    derived: { scores: opts.scores ?? {} },
    core: { entities: registry },
    editState: {
      addClass: opts.overrides?.addClass ?? vi.fn(),
      removeClass: opts.overrides?.removeClass ?? vi.fn(),
      setClassLevel: opts.overrides?.setClassLevel ?? vi.fn(),
    },
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

/** Bard with a chosen subclass (Champion-flavoured): the definition class entry
 *  carries `subclass`, and a registered subclass entity supplies the name. Used
 *  to pin the subclass-tag-next-to-title placement (smoke r7). */
function mkCtxWithBardSubclass(): ComponentRenderContext {
  const ctx = mkCtx({
    classEntries: [{ name: "srd-2024_bard", level: 5, subclass: "srd-2024_college-of-lore" }],
    entities: [
      entityOf("srd-2024_bard", "Bard", bardData()),
      entityOf("srd-2024_college-of-lore", "College of Lore", {} as ClassData, "subclass"),
    ],
  });
  return ctx;
}

function mkCtxNoClass(): ComponentRenderContext {
  return mkCtx({ classEntries: [], entities: [entityOf("srd-2024_bard", "Bard", bardData())] });
}

function mkCtxWithBard5(overrides: CtxOverrides): ComponentRenderContext {
  return mkCtx({
    classEntries: [{ name: "srd-2024_bard", level: 5 }],
    entities: [entityOf("srd-2024_bard", "Bard", bardData())],
    overrides,
  });
}

function mkCtxBardPlusWarlockLowCha(): ComponentRenderContext {
  return mkCtx({
    classEntries: [
      { name: "srd-2024_bard", level: 5 },
      { name: "srd-2024_warlock", level: 1 },
    ],
    entities: [
      entityOf("srd-2024_bard", "Bard", bardData()),
      entityOf("srd-2024_warlock", "Warlock", warlockData()),
    ],
    scores: { cha: 11 },
  });
}

function mkCtxWithOrphanSubclass(): ComponentRenderContext {
  const sub = entityOf(
    "srd-2024_path-of-the-berserker", "Path of the Berserker",
    { description: "A path of fury." } as ClassData, "subclass",
  );
  (sub.data as Record<string, unknown>).parent_class = "[[SRD 2024/Classes/Barbarian]]";
  return mkCtx({ classEntries: [], entities: [entityOf("srd-2024_bard", "Bard", bardData()), sub] });
}

describe("renderClassStep", () => {
  it("class-less: muted intro + ONE compact hero Add button, no card stack", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxNoClass());
    expect(c.querySelector(".pc-bcempty")).not.toBeNull();
    expect(c.querySelectorAll(".pc-bcadd").length).toBe(1);
    expect(c.querySelector(".pc-bcadd-wrap")!.classList.contains("hero")).toBe(true);
    expect(c.querySelector(".pc-bccard")).toBeNull();
  });

  it("owned: the block's identity band is the card header — name + inline LV pill + remove + chevron; body hosts the live strip", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ setClassLevel }));
    const card = c.querySelector(".pc-bccard")!;
    // No separate header strip any more — the Chronicle block IS the header.
    expect(card.querySelector(".pc-bccard-h")).toBeNull();
    const band = card.querySelector(".pc-cblock .pc-cb-bh.collapsible")!;
    expect(band.querySelector(".pc-cb-name")!.textContent).toBe("Bard");
    // Level PILL (picker A-II) lives inline in the band's right-side controls —
    // a `LV n` trigger over a popover, no native <select> and no stepper buttons.
    const lvl = band.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl-anchor .pc-bccard-lvl")!;
    expect(lvl.querySelector("select")).toBeNull();
    expect(lvl.querySelector(".pc-bccard-lvl-btn")).toBeNull();
    expect(lvl.querySelector(".pc-bccard-lvl-v")!.textContent).toBe("5");
    // Remove ghost is in the band too; collapse chevron at the far edge.
    expect(band.querySelector(".pc-bccard-rm")).not.toBeNull();
    expect(band.querySelector(".pc-cb-bh-chev")!.textContent).toBe("▾");
    expect(card.querySelector(".pc-cblock .pc-dstrip")).not.toBeNull();
  });

  it("clicking the LV pill opens an anchored parchment popover with a 4×5 grid (1–20), current level stamped crimson", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBard5({}));
    expect(c.querySelector(".pc-lvl-pop")).toBeNull();
    (c.querySelector(".pc-bccard-lvl") as HTMLElement).click();
    const panel = c.querySelector(".pc-bccard-lvl-anchor .pc-lvl-pop")!;
    expect(panel).not.toBeNull();
    expect(panel.querySelector(".pc-pop-arrow")).not.toBeNull(); // caret notch
    // Shared families: the panel is a `.pc-pop`, the grid a `.pc-numgrid`.
    expect(panel.classList.contains("pc-pop")).toBe(true);
    const cells = [...panel.querySelectorAll(".pc-numgrid-c")];
    expect(cells.length).toBe(20);
    expect(cells.map((x) => x.textContent)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 1)),
    );
    // Current level (5) carries the crimson `.cur` stamp; exactly one cell does.
    const cur = cells.filter((x) => x.classList.contains("cur"));
    expect(cur.length).toBe(1);
    expect(cur[0].textContent).toBe("5");
  });

  it("clicking a grid cell writes setClassLevel(0, n) and closes the popover", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ setClassLevel }));
    (c.querySelector(".pc-bccard-lvl") as HTMLElement).click();
    const cell = [...c.querySelectorAll(".pc-lvl-pop .pc-numgrid-c")].find((x) => x.textContent === "11") as HTMLElement;
    cell.click();
    expect(setClassLevel).toHaveBeenCalledWith(0, 11);
    // The write's re-render unmounts the panel; the commit also closes it.
    expect(c.querySelector(".pc-lvl-pop")).toBeNull();
  });

  it("re-clicking the LV pill toggles the popover closed (with no write)", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ setClassLevel }));
    const pill = c.querySelector(".pc-bccard-lvl") as HTMLElement;
    pill.click();
    expect(c.querySelector(".pc-lvl-pop")).not.toBeNull();
    pill.click();
    expect(c.querySelector(".pc-lvl-pop")).toBeNull();
    expect(setClassLevel).not.toHaveBeenCalled();
  });

  it("Escape and outside-click close the popover with no write", () => {
    // Escape.
    const c1 = mountContainer();
    const setClassLevel1 = vi.fn();
    renderClassStep(c1, mkCtxWithBard5({ setClassLevel: setClassLevel1 }));
    (c1.querySelector(".pc-bccard-lvl") as HTMLElement).click();
    expect(c1.querySelector(".pc-lvl-pop")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(c1.querySelector(".pc-lvl-pop")).toBeNull();
    expect(setClassLevel1).not.toHaveBeenCalled();

    // Outside click.
    const c2 = mountContainer();
    const setClassLevel2 = vi.fn();
    renderClassStep(c2, mkCtxWithBard5({ setClassLevel: setClassLevel2 }));
    (c2.querySelector(".pc-bccard-lvl") as HTMLElement).click();
    expect(c2.querySelector(".pc-lvl-pop")).not.toBeNull();
    document.body.click();
    expect(c2.querySelector(".pc-lvl-pop")).toBeNull();
    expect(setClassLevel2).not.toHaveBeenCalled();
  });

  it("owned: the collapsed 'Features by level' fold toggles open (then closed) on header click", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBard5({}));
    const card = c.querySelector(".pc-bccard")!;
    const featHeader = (): HTMLElement =>
      [...card.querySelectorAll(".pc-cb-fold-h")].find(
        (h) => h.textContent!.includes("Features by level"),
      ) as HTMLElement;

    // Owned mode collapses this fold by default — its body (the timeline) is
    // absent and the chevron reads closed. This is where subclass features live,
    // so it must be openable.
    expect(card.querySelector(".pc-cb-timeline")).toBeNull();
    expect(featHeader().querySelector(".pc-cb-fold-chev")!.textContent).toBe("▸");
    // A count hint makes the collapsed fold read as content-bearing.
    expect(featHeader().querySelector(".pc-cb-sec-r")!.textContent).toContain("1 feature");

    featHeader().click();
    expect(card.querySelector(".pc-cb-timeline")).not.toBeNull();
    expect(card.querySelector(".pc-cb-fn")!.textContent).toContain("Bardic Inspiration");
    expect(featHeader().querySelector(".pc-cb-fold-chev")!.textContent).toBe("▾");

    featHeader().click();
    expect(card.querySelector(".pc-cb-timeline")).toBeNull();
    expect(featHeader().querySelector(".pc-cb-fold-chev")!.textContent).toBe("▸");
  });

  it("remove is a two-step confirm: the first click does NOT remove; it swaps in Confirm/Cancel (smoke r7)", () => {
    const c = mountContainer();
    const removeClass = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ removeClass }));
    const rm = c.querySelector(".pc-bccard-rm") as HTMLElement;
    expect(rm.tagName).toBe("BUTTON");           // a proper ghost button, not a dotted-underline span
    rm.click();
    // First click NEVER removes — it reveals the confirm pair.
    expect(removeClass).not.toHaveBeenCalled();
    expect(c.querySelector(".pc-bccard-rm")).toBeNull();              // the bare Remove button is gone
    expect(c.querySelector(".pc-bccard-rm-confirm")).not.toBeNull();
    expect(c.querySelector(".pc-bccard-rm-cancel")).not.toBeNull();
    // Card never collapsed (no collapse flag written by the first click).
    expect(c.querySelector(".pc-cb-glance")).not.toBeNull();
  });

  it("remove confirm calls removeClass; cancel restores the safe Remove button (smoke r7)", () => {
    // Confirm path.
    const c1 = mountContainer();
    const removeClass = vi.fn();
    renderClassStep(c1, mkCtxWithBard5({ removeClass }));
    (c1.querySelector(".pc-bccard-rm") as HTMLElement).click();
    (c1.querySelector(".pc-bccard-rm-confirm") as HTMLElement).click();
    expect(removeClass).toHaveBeenCalledWith(0);

    // Cancel path: restores the Remove button without calling removeClass.
    const c2 = mountContainer();
    const removeClass2 = vi.fn();
    renderClassStep(c2, mkCtxWithBard5({ removeClass: removeClass2 }));
    (c2.querySelector(".pc-bccard-rm") as HTMLElement).click();
    (c2.querySelector(".pc-bccard-rm-cancel") as HTMLElement).click();
    expect(removeClass2).not.toHaveBeenCalled();
    expect(c2.querySelector(".pc-bccard-rm")).not.toBeNull();         // safe state restored
    expect(c2.querySelector(".pc-bccard-rm-confirm")).toBeNull();
  });

  it("the remove control never toggles collapse: confirm/cancel clicks stop propagation (smoke r7)", () => {
    const c = mountContainer();
    const ctx = mkCtxWithBard5({ removeClass: vi.fn() });
    renderClassStep(c, ctx);
    (c.querySelector(".pc-bccard-rm") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    (c.querySelector(".pc-bccard-rm-cancel") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // No collapse flag was ever written by any of the remove-control clicks.
    expect((ctx.builderUiState!.get("builder.class-cards") as Set<number> | undefined)?.has(0) ?? false).toBe(false);
    expect(c.querySelector(".pc-cb-glance")).not.toBeNull();
  });

  it("the level pill + popover do NOT toggle collapse (trigger + cell clicks stopPropagation)", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    const ctx = mkCtxWithBard5({ setClassLevel });
    renderClassStep(c, ctx);
    // Opening the pill must not collapse the band.
    const pill = c.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl") as HTMLElement;
    pill.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect((ctx.builderUiState!.get("builder.class-cards") as Set<number>).has(0)).toBe(false);
    expect(c.querySelector(".pc-cb-glance")).not.toBeNull();
    // Picking a cell writes the level but still must not collapse the band.
    const cell = [...c.querySelectorAll(".pc-lvl-pop .pc-numgrid-c")].find((x) => x.textContent === "6") as HTMLElement;
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(setClassLevel).toHaveBeenCalledWith(0, 6);
    expect((ctx.builderUiState!.get("builder.class-cards") as Set<number>).has(0)).toBe(false);
    expect(c.querySelector(".pc-cb-glance")).not.toBeNull();
  });

  it("band click collapses the WHOLE block (tiles + strip unmount), state survives in builderUiState", () => {
    const c = mountContainer();
    const ctx = mkCtxWithBard5({});
    renderClassStep(c, ctx);
    // Expanded: tiles + strip present.
    expect(c.querySelector(".pc-cb-glance")).not.toBeNull();
    expect(c.querySelector(".pc-cblock .pc-dstrip")).not.toBeNull();
    (c.querySelector(".pc-cb-bh.collapsible") as HTMLElement).click();
    // Collapsed: only the band survives — tiles, strip, and folds unmount.
    expect(c.querySelector(".pc-cb-glance")).toBeNull();
    expect(c.querySelector(".pc-cblock .pc-dstrip")).toBeNull();
    expect(c.querySelector(".pc-cb-fold")).toBeNull();
    // The band itself (name + chevron) still renders, now reading collapsed.
    expect(c.querySelector(".pc-cb-name")!.textContent).toBe("Bard");
    expect(c.querySelector(".pc-cb-bh-chev")!.textContent).toBe("▸");
    // Collapse persists in the existing builder.class-cards Set.
    expect((ctx.builderUiState!.get("builder.class-cards") as Set<number>).has(0)).toBe(true);
  });

  it("collapsed card keeps the level picker usable (open the popover + pick without expanding)", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    const ctx = mkCtxWithBard5({ setClassLevel });
    // Seed the card collapsed.
    ctx.builderUiState!.set("builder.class-cards", new Set([0]));
    renderClassStep(c, ctx);
    expect(c.querySelector(".pc-cb-glance")).toBeNull();      // confirm collapsed
    (c.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl") as HTMLElement).click();
    const cell = [...c.querySelectorAll(".pc-lvl-pop .pc-numgrid-c")].find((x) => x.textContent === "6") as HTMLElement;
    cell.click();
    expect(setClassLevel).toHaveBeenCalledWith(0, 6);
  });

  it("owned: a compact '+ Add another class' ghost renders below the stack", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBard5({}));
    const add = c.querySelector(".pc-bcadd")!;
    expect(add.textContent).toContain("Add another class");
    expect(c.querySelector(".pc-bcadd-wrap")!.classList.contains("hero")).toBe(false);
  });

  it("multiclass prereq: quiet amber note when a primary ability is under 13 — never a block", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxBardPlusWarlockLowCha());
    const note = c.querySelectorAll(".pc-bccard")[1].querySelector(".pc-bcprereq")!;
    expect(note.textContent).toContain("13");
    expect(note.querySelector(".pc-bcprereq-bang")!.textContent).toBe("!");
  });

  it("the chosen subclass name sits next to the class title, not in the band-right controls (smoke r7)", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBardSubclass());
    const nameEl = c.querySelector(".pc-cblock .pc-cb-name")!;
    // The subclass tag renders INSIDE the title heading ("Bard · College of Lore").
    const tag = nameEl.querySelector(".pc-bccard-sub")!;
    expect(tag).not.toBeNull();
    expect(tag.textContent).toContain("College of Lore");
    expect(nameEl.textContent).toContain("Bard");
    expect(nameEl.textContent).toContain("College of Lore");
    // It is NOT duplicated into the band's right controls.
    expect(c.querySelector(".pc-cb-bh-rgt .pc-bccard-sub")).toBeNull();
  });

  it("the band's LV control is the popover-pill shell with the 'Lv' microlabel + caret (picker A-II)", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBard5({}));
    // The LV control lives in the band-right inside a `.pc-bccard-lvl-anchor`
    // wrapper — now a `LV n ▾` pill that opens a popover, not a <select> or a
    // stepper. The microlabel reads "Lv" and the trigger carries a caret.
    const anchor = c.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl-anchor")!;
    const lvl = anchor.querySelector(".pc-bccard-lvl")!;
    expect(lvl.querySelector(".pc-bccard-lvl-l")!.textContent).toBe("Lv");
    expect(lvl.querySelector(".pc-bccard-lvl-cv")).not.toBeNull();
    expect(lvl.querySelector("select")).toBeNull();
    expect(lvl.querySelector(".pc-bccard-lvl-btn")).toBeNull();
  });

  it("orphan subclasses still get the data-ask callout", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithOrphanSubclass());
    expect(c.querySelector(".pc-bclass-orphan")).not.toBeNull();
  });
});
