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

  it("owned: card header carries seal, name, level select, remove, chevron; body hosts the live strip", () => {
    const c = mountContainer();
    const setClassLevel = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ setClassLevel }));
    const card = c.querySelector(".pc-bccard")!;
    expect(card.querySelector(".pc-bccard-nm")!.textContent).toBe("Bard");
    const sel = card.querySelector(".pc-bccard-h select") as HTMLSelectElement;
    expect(sel.value).toBe("5");
    sel.value = "6";
    sel.dispatchEvent(new Event("change"));
    expect(setClassLevel).toHaveBeenCalledWith(0, 6);
    expect(card.querySelector(".pc-cblock .pc-dstrip")).not.toBeNull();
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

  it("remove ghost link removes the class without toggling collapse", () => {
    const c = mountContainer();
    const removeClass = vi.fn();
    renderClassStep(c, mkCtxWithBard5({ removeClass }));
    (c.querySelector(".pc-bccard-rm") as HTMLElement).click();
    expect(removeClass).toHaveBeenCalledWith(0);
  });

  it("header click collapses the card (body unmounts), state survives in builderUiState", () => {
    const c = mountContainer();
    const ctx = mkCtxWithBard5({});
    renderClassStep(c, ctx);
    (c.querySelector(".pc-bccard-h") as HTMLElement).click();
    expect(c.querySelector(".pc-bccard-body")).toBeNull();
    expect((ctx.builderUiState!.get("builder.class-cards") as Set<number>).has(0)).toBe(true);
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

  it("orphan subclasses still get the data-ask callout", () => {
    const c = mountContainer();
    renderClassStep(c, mkCtxWithOrphanSubclass());
    expect(c.querySelector(".pc-bclass-orphan")).not.toBeNull();
  });
});
