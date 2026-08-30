/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderEquipmentStep, seedRegistry } from "../packages/obsidian/src/modules/pc/components/builder/equipment-step";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RegisteredEntity } from "@core/entity-registry";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { mountStep, entity } from "./fixtures/pc/builder-equipment-harness";

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

interface CtxOverrides {
  gp?: number;
  /** Origin choices as the FILE holds them · already `background:`-prefixed,
   *  which is the key `readOriginChoice` builds. */
  originChoices?: Record<string, unknown>;
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
  const adjustCurrency = vi.fn();
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
    currency: { cp: 0, sp: 0, ep: 0, gp: over.gp ?? 0, pp: 0 },
    builder_equipment_mode: mode, origin_choices: over.originChoices ?? {},
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
      adjustCurrency, addItem: vi.fn(), removeItem: vi.fn() } as never,
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
    expect(sync.mock.calls[0]).toHaveLength(1);
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
    // A first render in gold mode ADOPTS the budget · it writes nothing to the
    // wallet. Without these two the repaired stub would swallow Task 4's G10
    // mutant (adopt landing G), which only reddened here as a stub TypeError.
    expect((x.editState as unknown as { adjustCurrency: ReturnType<typeof vi.fn> }).adjustCurrency)
      .not.toHaveBeenCalled();
    expect((x.editState as unknown as { setCurrency: ReturnType<typeof vi.fn> }).setCurrency)
      .not.toHaveBeenCalled();
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

// The SRD-5e Rogue's unconditional kit, exactly as the shipped data declares it.
const ROGUE_FIXED = [{ kind: "fixed", grants: [{ item: "leather" }, { item: "dagger", qty: 2 }] }];

/** Record a class-level equipment choice. ⚠️ `readClassChoice` reads
 *  `ctx.resolved.definition.class[0].choices[1][key]` · the CHARACTER side, never
 *  `ctx.resolved.classes`. The level key is load-bearing. The harness aliases one
 *  object into both places so either write lands, but the character-side alias is
 *  the one that must not be dropped. */
function pick(h: ReturnType<typeof mountStep>, key: string, value: string) {
  (h.character.class[0].choices as Record<number, Record<string, unknown>>)[1][key] = value;
}

describe("R4-P5b · the Equipment step no longer mutates on navigation", () => {
  // G2 · the reported bug at render level. Pre-fix this wrote gp = 0.
  it("G2: a reopened finished character with G=0 is left completely alone", () => {
    const h = mountStep({ gp: 10, mode: undefined, startingEquipment: [] });
    h.render();
    expect(h.character.currency!.gp).toBe(10);
    expect(h.counts.onChange).toBe(0);
    expect(h.adjustSpy).not.toHaveBeenCalled();
    expect(h.setCurrencySpy).not.toHaveBeenCalled();
  });

  // G3 · the same, with a genuinely NON-ZERO justified contribution and the kit
  // already untagged. ⚠️ ROGUE_FIXED alone grants no gold, so a fixture built
  // from it would silently duplicate G2 on the gold axis; the surviving
  // `equipment-1` choice is what makes G = 5 here.
  it("G3: a reopened finished character with G>0 is left completely alone", () => {
    const h = mountStep({
      gp: 900, mode: undefined,
      startingEquipment: [
        ...ROGUE_FIXED,
        { kind: "choice", options: [{ label: "5 GP", grants: [{ gold: 5 }] }] },
      ],
      choices: { 1: { "equipment-1": "option-0" } },   // survives finishBuild
      equipment: [
        { item: "[[srd-5e_armor_leather]]", equipped: true, slot: "armor" },
        { item: "[[srd-5e_weapon_dagger]]", qty: 2 },
      ] as never,
    });
    const before = h.character.equipment.length;
    h.render();
    expect(h.character.currency!.gp).toBe(900);   // pre-fix this became 5
    expect(h.character.equipment).toHaveLength(before);
    expect(h.counts.onChange).toBe(0);
  });

  // G11 · a hand-edited wallet is never reverted.
  it("G11: a hand-edited gp survives two further renders with no user action", () => {
    const h = mountStep({ gp: 0, mode: "starting", startingEquipment: [] });
    h.render();                       // adopt
    h.es.setCurrency("gp", 42);       // the inline strip's absolute set
    h.render();
    h.render();
    expect(h.character.currency!.gp).toBe(42);
  });

  // G14 · the genuine first build still seeds its unconditional kit.
  it("G14: a fresh 2014 Rogue draft seeds leather + 2 daggers on its first render", () => {
    const h = mountStep({ mode: "starting", startingEquipment: ROGUE_FIXED });
    h.render();
    const items = h.character.equipment.map((e) => e.item);
    expect(items).toContain("[[srd-5e_armor_leather]]");
    expect(items).toContain("[[srd-5e_weapon_dagger]]");
    expect(h.character.equipment.every((e) => e.granted_by === "builder:starting")).toBe(true);
  });

  // G15 · a mode round trip restores the kit rather than losing it.
  it("G15: starting -> gold -> starting restores the seeded kit", () => {
    const h = mountStep({ mode: "starting", startingEquipment: ROGUE_FIXED });
    h.render();
    expect(h.character.equipment.length).toBeGreaterThan(0);
    h.es.setBuilderEquipmentMode("gold");
    expect(h.character.equipment).toHaveLength(0);   // the switch drops all builder:* gear
    h.render();
    h.es.setBuilderEquipmentMode("starting");
    h.render();
    expect(h.character.equipment.map((e) => e.item)).toContain("[[srd-5e_armor_leather]]");
  });

  // G1 · re-entrancy. A real onChange that re-renders must converge.
  it("G1: a granting reconcile under a re-rendering onChange calls adjustCurrency exactly once", () => {
    const h = mountStep({
      gp: 0, mode: "starting", reRenderOnChange: true,
      startingEquipment: [{ kind: "choice", options: [
        { label: "155 GP", grants: [{ gold: 155 }] },
      ] }],
    });
    h.render();                                            // adopt, G = 0
    pick(h, "equipment-0", "option-0");
    h.render();                                            // G = 155, applies once
    expect(h.adjustSpy).toHaveBeenCalledTimes(1);
    expect(h.adjustSpy).toHaveBeenCalledWith({ gp: 155 });
    expect(h.character.currency!.gp).toBe(155);
  });
});

const FIGHTER_155 = [{ kind: "choice", options: [
  { label: "Chain Mail", grants: [{ item: "chain-mail" }] },
  { label: "155 GP", grants: [{ gold: 155 }] },
] }];

// `pick()` is defined in Task 3's block above · do NOT redeclare it here. A
// duplicate top-level `function pick` is a hard esbuild error ("The symbol
// "pick" has already been declared") and the whole file fails to transform.

describe("R4-P5b · mode, clamp and residual behaviour", () => {
  // G7 · the genuine first-build grant still works, on a draft with no currency key.
  it("G7: picking the 155 GP option on a fresh draft deposits 155", () => {
    const h = mountStep({ mode: "starting", startingEquipment: FIGHTER_155 });
    h.render();                                   // adopt at G = 0
    expect(h.character.currency).toBeUndefined(); // adopt-only leaves no currency line
    pick(h, "equipment-0", "option-1");
    h.render();
    expect(h.character.currency!.gp).toBe(155);
  });

  // G5 · the arithmetic, asserted on the CALL, not only the end state.
  it("G5: applies the clamped difference against `applied` and never uses setCurrency", () => {
    const h = mountStep({ gp: 7, mode: "starting", startingEquipment: FIGHTER_155 });
    h.bag!.set("builder.eqrec.gold", { applied: 100, lastG: 90 });
    pick(h, "equipment-0", "option-1");
    h.render();
    expect(h.adjustSpy).toHaveBeenCalledTimes(1);
    expect(h.adjustSpy).toHaveBeenCalledWith({ gp: 55 });
    expect(h.setCurrencySpy).not.toHaveBeenCalled();
    expect(h.character.currency!.gp).toBe(62);
  });

  // G10 · a draft saved under the OLD semantics adopts and writes nothing, twice over.
  it("G10: mid-build back-compat · gp already equal to the budget produces zero writes", () => {
    const h = mountStep({ gp: 155, mode: "gold", startingGold: { fixed: 155 } });
    h.render();
    h.render();
    expect(h.counts.onChange).toBe(0);
    expect(h.character.currency!.gp).toBe(155);
  });

  // G12 · E1 pinned: an absolute set does not discharge the builder's claim.
  it("G12: 100 -> types 200 -> gold (+50) -> empty (-55) -> 195", () => {
    const h = mountStep({ gp: 100, mode: "starting", startingGold: { fixed: 55 },
      startingEquipment: [{ kind: "choice", options: [{ label: "5 GP", grants: [{ gold: 5 }] }] }] });
    pick(h, "equipment-0", "option-0");
    h.render();                                   // adopt at G = 5
    h.es.setCurrency("gp", 200);
    h.es.setBuilderEquipmentMode("gold");
    h.render();                                   // G = 55, intended 55 - 5 = +50
    expect(h.character.currency!.gp).toBe(250);
    h.es.setBuilderEquipmentMode("empty");
    h.render();                                   // G = 0, intended 0 - 55 = -55
    expect(h.character.currency!.gp).toBe(195);
  });

  // G9 · a bag reset re-adopts; the reclaim is bounded by the wallet.
  it("G9: after a bag reset the next render adopts, and the empty switch reclaims G, floored at 0", () => {
    const h = mountStep({ gp: 162, mode: "gold", startingGold: { fixed: 155 } });
    h.render();
    h.bag!.clear();                               // simulate a non-echo setViewData
    h.render();                                   // re-adopt at G = 155
    expect(h.counts.onChange).toBe(0);
    h.es.setBuilderEquipmentMode("empty");
    h.render();
    expect(h.character.currency!.gp).toBe(7);     // 162 - 155, NOT "reclaims nothing"
  });

  it("G9b: the same reclaim floors at 0 rather than going negative", () => {
    const h = mountStep({ gp: 7, mode: "gold", startingGold: { fixed: 155 } });
    h.render();                                   // adopt at G = 155
    h.es.setBuilderEquipmentMode("empty");
    h.render();
    expect(h.character.currency!.gp).toBe(0);
  });

  // G18 · a clamped reclaim must not create gold on the way back.
  it("G18: 7 -> +155 -> spend 160 -> Start Empty -> Starting Equipment ends at 2, not 155", () => {
    const h = mountStep({ gp: 7, mode: "starting", startingEquipment: FIGHTER_155 });
    h.render();                                   // adopt at G = 0
    pick(h, "equipment-0", "option-1");
    h.render();                                   // +155 -> 162
    expect(h.character.currency!.gp).toBe(162);
    h.es.setCurrency("gp", 2);                    // the user spends 160
    h.es.setBuilderEquipmentMode("empty");
    h.render();                                   // reclaim clamped to -2 -> 0
    expect(h.character.currency!.gp).toBe(0);
    h.es.setBuilderEquipmentMode("starting");
    h.render();                                   // re-grant lands +2
    expect(h.character.currency!.gp).toBe(2);
  });

  // G19 · the two DECIDED residuals of the latent remainder. These are accepted
  // behaviour; the guard exists so a future change cannot alter them silently.
  it("G19 arm A: a grant can be withheld after a clamped reclaim (accepted residual)", () => {
    const h = mountStep({ gp: 0, mode: "starting", startingGold: { fixed: 155 },
      startingEquipment: FIGHTER_155 });
    h.render();                                   // adopt at G = 0
    h.es.setBuilderEquipmentMode("gold");
    h.render();                                   // +155 -> 155
    h.es.setCurrency("gp", 0);                    // the user types 0
    h.es.setBuilderEquipmentMode("starting");
    h.render();                                   // reclaim clamps to 0; applied stays 155
    expect(h.character.currency!.gp).toBe(0);
    pick(h, "equipment-0", "option-1");
    h.render();                                   // G = 155, intended 155 - 155 = 0
    expect(h.character.currency!.gp).toBe(0);     // the grant is withheld
  });

  it("G19 arm B: a later balance is over-reclaimed (accepted residual)", () => {
    const h = mountStep({ gp: 0, mode: "starting", startingGold: { fixed: 155 },
      startingEquipment: FIGHTER_155 });
    h.render();
    h.es.setBuilderEquipmentMode("gold");
    h.render();
    h.es.setCurrency("gp", 0);
    h.es.setBuilderEquipmentMode("starting");
    h.render();                                   // desynced: applied 155, lastG 0
    h.es.setCurrency("gp", 500);                  // NOT the coin modal - it is closed in the builder
    h.es.setBuilderEquipmentMode("gold");
    h.render();                                   // intended 0, no call, lastG -> 155
    expect(h.character.currency!.gp).toBe(500);
    h.es.setBuilderEquipmentMode("starting");
    h.render();                                   // intended -155
    expect(h.character.currency!.gp).toBe(345);
  });

  // G16 · E5 pinned, plus the qty arm of the gear gate.
  // ⚠️ The untagged original must NOT cover the whole resolved multiset, or the
  // gate correctly skips and the test measures G3's behaviour instead of E5's.
  // Here the file holds leather but not the two daggers, so containment fails,
  // the seed fires, and leather ends up duplicated · which IS E5.
  it("G16: a re-pick on a reopened finished character adds the new kit beside the untagged original", () => {
    const h = mountStep({
      mode: undefined,
      startingEquipment: [{ kind: "choice", options: [
        { label: "Leather + 2 daggers", grants: [{ item: "leather" }, { item: "dagger", qty: 2 }] },
      ] }],
      equipment: [{ item: "[[srd-5e_armor_leather]]", equipped: true, slot: "armor" }] as never,
    });
    h.render();
    pick(h, "equipment-0", "option-0");
    h.render();
    const items = h.character.equipment.map((e) => e.item);
    expect(items.filter((i) => i === "[[srd-5e_armor_leather]]")).toHaveLength(2);
    expect(h.character.equipment.some((e) => e.granted_by === "builder:starting")).toBe(true);
  });

  it("G16b: a hand-added single dagger does NOT suppress a dagger x2 seed", () => {
    const h = mountStep({
      mode: undefined,
      startingEquipment: [{ kind: "fixed", grants: [{ item: "dagger", qty: 2 }] }],
      equipment: [{ item: "[[srd-5e_weapon_dagger]]" }] as never,
    });
    h.render();
    expect(h.character.equipment.some((e) => e.granted_by === "builder:starting")).toBe(true);
  });
});

describe("R4-P5b · the dead background limb and the no-bag disable", () => {
  // §7.1 · pins CURRENT behaviour, deliberately. The Equipment step reads
  // `background.starting_equipment`, but BackgroundEntity's key is `equipment`,
  // so the whole background limb is dead: no rows render and no gold is granted.
  // This is recorded as its own unowned row; the fixture exists so that repairing
  // the key reddens here rather than silently changing what characters receive.
  //
  // ⚠️ Three things ARM it · without any one of them the repair changes nothing
  // here and the guard is decoration:
  //   · the entry is `kind: "choice"`. The background section rule (and the name
  //     "Acolyte" with it) is gated on `hasChoice`, which is `kind === "choice"`,
  //     so a `fixed` entry stays invisible even with the key repaired.
  //   · the pick is recorded under `background:equipment-0` · the key
  //     `readOriginChoice` builds · so `resolveSelections` actually consumes the
  //     option and its 15 gp instead of returning at the unselected branch.
  //   · the baseline is pre-seeded. On a FRESH bag `goldStep` takes rule 1
  //     (adopt), which lands 0 whatever the contribution is, and would mask the
  //     write entirely; seeded at lastG 0 a repaired limb takes rule 3 instead.
  // Repaired, BOTH assertions go red: "Acolyte" renders and adjustCurrency is
  // called with { gp: 15 }. `expect.soft` so one run evidences both arms.
  it("a background's starting equipment is NOT rendered or granted (dead limb, pinned)", () => {
    const c = mountContainer();
    const background = { name: "Acolyte", equipment: [
      { kind: "choice", options: [{ label: "15 GP", grants: [{ gold: 15 }] }] },
    ] };
    const x = ctx({ background, startingEquipment: [],
      originChoices: { "background:equipment-0": "option-0" } });
    x.builderUiState!.set("builder.eqrec.gold", { applied: 0, lastG: 0 });
    renderEquipmentStep(c, x);
    expect.soft(c.textContent).not.toContain("Acolyte");
    expect.soft((x.editState as unknown as { adjustCurrency: ReturnType<typeof vi.fn> }).adjustCurrency)
      .not.toHaveBeenCalled();
  });

  // G8 · no bag means the gold half is disabled outright, never "always adopt".
  // ⚠️ The kit must GRANT GOLD, so this fixture is inline rather than ROGUE_FIXED:
  // with G = 0 every write-shaped degradation of `reconcileGold` still lands 0 and
  // the two spy assertions can never fire · only the gear assertion would carry a
  // kill. At +10 gp the spec's named degradation ("no store ⇒ deposit anyway")
  // deposits a real, wrong 10 gp and `adjustSpy` catches it.
  it("G8: with no builderUiState the gold reconcile writes nothing, and gear still seeds", () => {
    const h = mountStep({ bag: false, mode: "starting", startingEquipment: [
      { kind: "fixed", grants: [{ item: "leather" }, { item: "dagger", qty: 2 }, { gold: 10 }] },
    ] });
    h.render();
    expect(h.adjustSpy).not.toHaveBeenCalled();
    expect(h.setCurrencySpy).not.toHaveBeenCalled();
    expect(h.character.equipment.length).toBeGreaterThan(0);   // the gear half is unaffected
  });
});

// R4-G1a D5 / G9: the `fixed` branch of the live reconcile.
describe("renderEquipmentStep · a fixed entry with no grants (R4-G1a D5, G9)", () => {
  it("Starting mode: the reconcile runs with no throw and seeds nothing", () => {
    const h = mountStep({ mode: "starting", startingEquipment: [{ kind: "fixed" }] });
    expect(() => h.render()).not.toThrow();
    expect(h.character.equipment).toHaveLength(0);
  });
});
