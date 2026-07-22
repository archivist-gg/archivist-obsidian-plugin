/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderEquipmentStep, seedRegistry } from "../packages/obsidian/src/modules/pc/components/builder/equipment-step";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";

beforeAll(() => installObsidianDomHelpers());

/** A faithful registry over a fixed pool, mirroring the EntityRegistry surface
 *  the decision-engine + seedRegistry adapter use: search(query, type, n),
 *  getBySlug(slug), getByTypeAndSlug(type, slug). */
function makeRegistry(pool: RegisteredEntity[]) {
  return {
    search: (q: string, type: string, _n: number) =>
      pool.filter((e) => e.entityType === type && e.name.toLowerCase().includes(q.toLowerCase())),
    getBySlug: (slug: string) => pool.find((e) => e.slug === slug),
    getByTypeAndSlug: (type: string, slug: string) =>
      pool.find((e) => e.entityType === type && e.slug === slug),
  };
}

function entity(slug: string, name: string, entityType: string, data: Record<string, unknown> = {}): RegisteredEntity {
  return { slug, name, entityType, filePath: "", data, compendium: "SRD", readonly: true, homebrew: false };
}

interface CtxOverrides {
  startingEquipment?: unknown[];
  mode?: "starting" | "gold" | "empty";
  choices?: Record<number, Record<string, unknown>>;
  classes?: unknown[];
  pool?: RegisteredEntity[];
  background?: unknown;
}

function ctx(over: CtxOverrides = {}): ComponentRenderContext {
  const setChoice = vi.fn();
  const setOriginChoice = vi.fn();
  const syncStartingEquipment = vi.fn();
  const setBuilderEquipmentMode = vi.fn();
  const setCurrency = vi.fn();
  const startingEquipment = over.startingEquipment ?? [
    { kind: "choice", options: [
      { label: "Chain Mail, Greatsword", grants: [{ item: "chain-mail" }] },
      { label: "155 GP", grants: [{ gold: 155 }] },
    ] },
  ];
  const mode = over.mode ?? "starting";
  const choices = over.choices ?? { 1: {} };
  const classDef = { name: "[[srd-2024_fighter]]", level: 1, choices, subclass: null };
  const classEntity = {
    slug: "srd-2024_fighter", name: "Fighter",
    starting_equipment: startingEquipment, starting_gold: undefined,
  };
  const classes = over.classes ?? [{ entity: classEntity, level: 1, subclass: null, choices }];
  const pool = over.pool ?? [
    entity("srd-2024_chain-mail", "Chain Mail", "armor", { category: "heavy" }),
    entity("srd-2024_greatsword", "Greatsword", "weapon", { category: "martial-melee" }),
  ];
  const definition = {
    name: "Test", class: over.classes !== undefined ? [] : [classDef],
    background: over.background ?? null, equipment: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    builder_equipment_mode: mode, origin_choices: {},
  };
  // Keep definition.class in sync when classes is explicitly empty (empty-mode test).
  if (over.classes !== undefined) definition.class = over.classes.length ? [classDef] : [];

  return {
    resolved: {
      definition,
      classes: classes as never,
      background: (over.background ?? null) as never,
      race: null, feats: [], totalLevel: 1, features: [], spells: [], pools: [], state: {} as never,
    } as never,
    derived: {} as never,
    app: {} as never,
    services: { entities: makeRegistry(pool) } as never,
    editState: { setChoice, setOriginChoice, syncStartingEquipment, setBuilderEquipmentMode, setCurrency,
      addItem: vi.fn(), removeItem: vi.fn() } as never,
    builderUiState: new Map(),
  } as unknown as ComponentRenderContext;
}

describe("renderEquipmentStep", () => {
  it("renders the 3-way mode toggle with Starting Equipment active", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx());
    expect(c.querySelectorAll(".pc-bmtab").length).toBe(3);
    expect(c.querySelector(".pc-bmtab.on")!.textContent).toContain("Starting Equipment");
  });

  it("renders each class equipment option as a .pc-cb-eqopt row", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx());
    expect(c.querySelectorAll(".pc-cb-eqopt").length).toBe(2);
  });

  it("shows a +N GP gold caption on a gold-bearing option", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx());
    const gold = c.querySelector(".pc-cb-eqgold");
    expect(gold).toBeTruthy();
    expect(gold!.textContent).toContain("155");
  });

  it("clicking an option writes the choice", () => {
    const c = mountContainer();
    const x = ctx();
    renderEquipmentStep(c, x);
    (c.querySelectorAll(".pc-cb-eqopt")[1] as HTMLElement).click();
    expect((x.editState as { setChoice: ReturnType<typeof vi.fn> }).setChoice)
      .toHaveBeenCalledWith(0, 1, "equipment-0", "option-1");
  });

  it("marks the selected option with .sel", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx({ choices: { 1: { "equipment-0": "option-0" } } }));
    const rows = c.querySelectorAll(".pc-cb-eqopt");
    expect(rows[0].classList.contains("sel")).toBe(true);
    expect(rows[1].classList.contains("sel")).toBe(false);
  });

  it("reconciles selections into syncStartingEquipment", () => {
    const c = mountContainer();
    const x = ctx({ choices: { 1: { "equipment-0": "option-0" } } });
    renderEquipmentStep(c, x);
    const sync = (x.editState as { syncStartingEquipment: ReturnType<typeof vi.fn> }).syncStartingEquipment;
    expect(sync).toHaveBeenCalled();
    const [entries] = sync.mock.calls[0];
    expect(entries.map((e: { slug: string }) => e.slug)).toContain("srd-2024_chain-mail");
  });

  it("Start Empty mode shows the quiet note", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx({ mode: "empty", classes: [] }));
    expect(c.textContent!.toLowerCase()).toContain("no equipment");
  });

  it("switching mode calls setBuilderEquipmentMode", () => {
    const c = mountContainer();
    const x = ctx();
    renderEquipmentStep(c, x);
    const empty = [...c.querySelectorAll(".pc-bmtab")].find((b) => b.textContent!.includes("Empty"))!;
    (empty as HTMLElement).click();
    expect((x.editState as { setBuilderEquipmentMode: ReturnType<typeof vi.fn> }).setBuilderEquipmentMode)
      .toHaveBeenCalledWith("empty");
  });

  it("renders a nested entity picker for a selected option with a {category} grant", () => {
    const c = mountContainer();
    const startingEquipment = [
      { kind: "choice", options: [
        { label: "A martial weapon", grants: [{ category: "martial-weapon" }] },
        { label: "Two handaxes", grants: [{ item: "handaxe", qty: 2 }] },
      ] },
    ];
    // Select option-0 (the martial-weapon branch) so its nested select-entity child is revealed.
    const x = ctx({ startingEquipment, choices: { 1: { "equipment-0": "option-0" } } });
    renderEquipmentStep(c, x);
    // The reused decision-strip select-entity renderer surfaces the nested picker:
    // a small candidate list renders the shared selection table (.pc-btable-host),
    // a long one a "Browse all N ▸" ghost. Either way the strip nest is present.
    const picker = c.querySelector(".pc-btable-host, .pc-dstrip-browse, .pc-dstrip-nest");
    expect(picker).toBeTruthy();
  });

  it("renders a visible warning + does not crash when class equipment is old-shape", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const c = mountContainer();
      // OLD-shape options: plain strings instead of { label, grants } objects.
      const x = ctx({ startingEquipment: [{ kind: "choice", options: ["(a) chain mail", "(b) 75 GP"] }] });
      expect(() => renderEquipmentStep(c, x)).not.toThrow();
      // A visible amber notice surfaces the degradation (reuses the .pc-bwarn idiom).
      expect(c.querySelector(".pc-bwarn")).not.toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it("does NOT show the degraded-equipment warning for GOOD new-shape equipment", () => {
    const c = mountContainer();
    renderEquipmentStep(c, ctx());
    expect(c.querySelector(".pc-bwarn")).toBeNull();
  });

  it("Buy with Gold shows a gold meter from starting_gold.fixed", () => {
    const c = mountContainer();
    const classEntity = {
      slug: "srd-2024_fighter", name: "Fighter",
      starting_equipment: [], starting_gold: { fixed: 155 },
    };
    const x = ctx({
      mode: "gold",
      classes: [{ entity: classEntity, level: 1, subclass: null, choices: { 1: {} } }],
    });
    renderEquipmentStep(c, x);
    // The starting-gold budget meter renders (real .pc-bctx idiom) and shows 155.
    expect(c.querySelector(".pc-bctx")).not.toBeNull();
    expect(c.textContent).toContain("155");
  });

  it("Buy with Gold does NOT crash on old-shape starting equipment (string options)", () => {
    const c = mountContainer();
    // No starting_gold, so startingBudget falls through to the gold-only-option
    // fallback loop, which reads each option's grants. OLD-shape options are plain
    // strings (no .grants), so an unguarded read would throw. The guard keeps it safe.
    const classEntity = {
      slug: "srd-2024_fighter", name: "Fighter",
      starting_equipment: [{ kind: "choice", options: ["(a) chain mail", "(b) 75 GP"] }],
      starting_gold: undefined,
    };
    const x = ctx({
      mode: "gold",
      classes: [{ entity: classEntity, level: 1, subclass: null, choices: { 1: {} } }],
    });
    expect(() => renderEquipmentStep(c, x)).not.toThrow();
  });

  // R3-P6 non-site regression guard: class-GRANTED starting equipment must resolve
  // from ANY compendium, including a hidden one. seedRegistry reads the registry
  // directly and never consults hiddenCompendiums; this catches a FUTURE accidental
  // filter leaked into that non-site path. Non-vacuous: chain-mail's compendium
  // ("SRD 5e") IS in the hidden set, so a wrongly-added visibility filter would
  // drop it and lookup would return null.
  it("seedRegistry grant resolution ignores compendium visibility (non-site guard)", () => {
    const registry = buildMockRegistry([
      { slug: "srd-5e_armor_chain-mail", name: "Chain Mail", entityType: "armor",
        data: {}, compendium: "SRD 5e" },
    ]);
    const x = {
      services: { entities: registry, plugin: { settings: { hiddenCompendiums: ["SRD 5e"] } } },
    } as unknown as ComponentRenderContext;
    const seed = seedRegistry(x);
    // bareEntitySlug strips the 3-part namespaced slug down to "chain-mail".
    expect(seed.lookup("chain-mail")).not.toBeNull();
    expect(seed.lookup("chain-mail")!.fullSlug).toBe("srd-5e_armor_chain-mail");
  });
});
