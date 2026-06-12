/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderClassStep } from "../src/modules/pc/components/builder/class-step";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";
import type { ClassData } from "../src/modules/pc/components/builder/class-chronicle";

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

  it("owned: the block's identity band is the card header — name + inline level stepper + remove + chevron; body hosts the live strip", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ setClassLevel }));
    const card = c.querySelector(".pc-bccard")!;
    // No separate header strip any more — the Chronicle block IS the header.
    expect(card.querySelector(".pc-bccard-h")).toBeNull();
    const band = card.querySelector(".pc-cblock .pc-cb-bh.collapsible")!;
    expect(band.querySelector(".pc-cb-name")!.textContent).toBe("Bard");
    // Level STEPPER (picker A-I) lives inline in the band's right-side controls —
    // a `[−] value [+]` pill, no native <select>.
    const lvl = band.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl")!;
    expect(lvl.querySelector("select")).toBeNull();
    expect(lvl.querySelector(".pc-bccard-lvl-v")!.textContent).toBe("5");
    const [minus, plus] = [...lvl.querySelectorAll(".pc-bccard-lvl-btn")] as HTMLButtonElement[];
    plus.click();
    expect(setClassLevel).toHaveBeenLastCalledWith(0, 6);
    minus.click();
    expect(setClassLevel).toHaveBeenLastCalledWith(0, 4);
    // Remove ghost is in the band too; collapse chevron at the far edge.
    expect(band.querySelector(".pc-bccard-rm")).not.toBeNull();
    expect(band.querySelector(".pc-cb-bh-chev")!.textContent).toBe("▾");
    expect(card.querySelector(".pc-cblock .pc-dstrip")).not.toBeNull();
  });

  it("the level stepper clamps to 1–20: − disabled at level 1, + disabled at level 20", () => {
    // Level 1 → minus disabled, plus enabled.
    const c1 = mountContainer();
    renderClassStep(c1, mkCtx({
      classEntries: [{ name: "srd-2024_bard", level: 1 }],
      entities: [entityOf("srd-2024_bard", "Bard", bardData())],
    }));
    const lvl1 = c1.querySelector(".pc-bccard-lvl")!;
    const [m1, p1] = [...lvl1.querySelectorAll(".pc-bccard-lvl-btn")] as HTMLButtonElement[];
    expect(lvl1.querySelector(".pc-bccard-lvl-v")!.textContent).toBe("1");
    expect(m1.disabled).toBe(true);
    expect(p1.disabled).toBe(false);

    // Level 20 → plus disabled, minus enabled.
    const c2 = mountContainer();
    renderClassStep(c2, mkCtx({
      classEntries: [{ name: "srd-2024_bard", level: 20 }],
      entities: [entityOf("srd-2024_bard", "Bard", bardData())],
    }));
    const lvl2 = c2.querySelector(".pc-bccard-lvl")!;
    const [m2, p2] = [...lvl2.querySelectorAll(".pc-bccard-lvl-btn")] as HTMLButtonElement[];
    expect(lvl2.querySelector(".pc-bccard-lvl-v")!.textContent).toBe("20");
    expect(m2.disabled).toBe(false);
    expect(p2.disabled).toBe(true);
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

  it("the level stepper does NOT toggle collapse when its buttons are clicked (stopPropagation)", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    const ctx = mkCtxWithBard5({ setClassLevel });
    renderClassStep(c, ctx);
    const plus = [...c.querySelectorAll(".pc-cb-bh-rgt .pc-bccard-lvl-btn")].at(-1) as HTMLButtonElement;
    plus.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // The write fired, but the band's collapse handler never did.
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

  it("collapsed card keeps the level control usable (level change without expanding)", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    const ctx = mkCtxWithBard5({ setClassLevel });
    // Seed the card collapsed.
    ctx.builderUiState!.set("builder.class-cards", new Set([0]));
    renderClassStep(c, ctx);
    expect(c.querySelector(".pc-cb-glance")).toBeNull();      // confirm collapsed
    const plus = [...c.querySelectorAll(".pc-cb-bh-rgt .pc-bccard-lvl-btn")].at(-1) as HTMLButtonElement;
    plus.click();
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

  it("the band's LV control is the in-pill stepper shell with the 'Lv' microlabel (picker A-I)", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithBard5({}));
    // The LV control lives in the band-right inside the .pc-bccard-lvl shell — now
    // a stepper, not a <select>. The microlabel reads "Lv".
    const lvl = c.querySelector(".pc-cb-bh-rgt .pc-bccard-lvl")!;
    expect(lvl.querySelector(".pc-bccard-lvl-l")!.textContent).toBe("Lv");
    expect(lvl.querySelector("select")).toBeNull();
    expect(lvl.querySelectorAll(".pc-bccard-lvl-btn").length).toBe(2);
  });

  it("orphan subclasses still get the data-ask callout", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithOrphanSubclass());
    expect(c.querySelector(".pc-bclass-orphan")).not.toBeNull();
  });
});
