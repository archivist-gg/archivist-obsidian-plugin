/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { BuilderView } from "../src/modules/pc/components/builder-view";
import { BUILDER_STEPS } from "../src/modules/pc/components/builder-steps";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

function ctx(): ComponentRenderContext {
  return {
    resolved: { definition: { name: "Valeria", class: [] } },
    derived: { totalLevel: 0, proficiencyBonus: 2, hp: { max: 0 }, ac: 10 },
    editState: null,
  } as unknown as ComponentRenderContext;
}

describe("BuilderView shell", () => {
  it("renders six step-rail items", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    expect(root.querySelectorAll(".pc-builder-step").length).toBe(6);
  });

  it("starts on the first step (race) marked active", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    const active = root.querySelector(".pc-builder-step.active");
    expect(active?.getAttribute("data-step")).toBe("race");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("race");
  });

  it("clicking a rail item switches the active step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='abilities']")!.click();
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("abilities");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("abilities");
  });

  it("shows a Finish action on the last step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    expect(root.querySelector(".pc-builder-finish")).not.toBeNull();
  });

  it("Finish carries no theme-accent mod-cta class, and nor does Next", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    const next = root.querySelector(".pc-builder-next");
    expect(next).not.toBeNull();
    expect(next?.classList.contains("mod-cta")).toBe(false);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    const finish = root.querySelector(".pc-builder-finish");
    expect(finish?.classList.contains("mod-cta")).toBe(false);
  });

  it("Finish is disabled with a title hint while the character has no class", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx()); // ctx() has class: []
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    const finish = root.querySelector<HTMLButtonElement>(".pc-builder-finish")!;
    expect(finish.disabled).toBe(true);
    expect(finish.title).toMatch(/class/i);
  });

  it("Finish is enabled and calls editState.finishBuild() once a class is chosen", () => {
    const root = mountContainer();
    const finishBuild = vi.fn();
    const c = {
      ...ctx(),
      resolved: { definition: { name: "Valeria", class: [{ name: "[[srd-5e_fighter]]", level: 1 }] } },
      editState: { finishBuild, seedHitDice: vi.fn(), seedHpToMax: vi.fn(), setHpMax: vi.fn() },
      builderUiState: new Map(),
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    const finish = root.querySelector<HTMLButtonElement>(".pc-builder-finish")!;
    expect(finish.disabled).toBe(false);
    finish.click();
    expect(finishBuild).toHaveBeenCalledTimes(1);
  });

  it("hides Back on the first step and the Back button returns to the previous step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    expect(root.querySelector(".pc-builder-back")).toBeNull();
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='class']")!.click();
    root.querySelector<HTMLElement>(".pc-builder-back")!.click();
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("race");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("race");
  });

  it("honors ctx.activeStepId over the default first step", () => {
    const root = mountContainer();
    const c = { ...ctx(), activeStepId: "abilities" } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    expect(root.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("abilities");
    expect(root.querySelector(".pc-builder-body")?.getAttribute("data-step")).toBe("abilities");
  });

  it("fires onActiveStepChange on rail clicks and Back/Next", () => {
    const root = mountContainer();
    const seen: string[] = [];
    const c = { ...ctx(), onActiveStepChange: (id: string) => seen.push(id) } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='class']")!.click();
    root.querySelector<HTMLElement>(".pc-builder-back")!.click();
    root.querySelector<HTMLElement>(".pc-builder-next")!.click();
    expect(seen).toEqual(["class", "race", "class"]);
  });

  it("holds no instance state: a second render with a fresh ctx starts at race", () => {
    const root = mountContainer();
    const view = new BuilderView();
    view.render(root, { ...ctx(), activeStepId: "details" } as unknown as ComponentRenderContext);
    const rootB = mountContainer();
    view.render(rootB, ctx());
    expect(rootB.querySelector(".pc-builder-step.active")?.getAttribute("data-step")).toBe("race");
  });

  it("mounts the race picker in the race step and wires setRace", () => {
    const root = mountContainer();
    const setRace = vi.fn();
    const c = {
      ...ctx(),
      editState: { setRace },
      builderUiState: new Map(),
      core: {
        plugin: {},
        entities: { search: () => [{
          slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
          data: { name: "Elf", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
        }] },
        compendiums: { getAll: () => [{ name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" }] },
        modules: { getByEntityType: () => undefined },
      },
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    expect(root.querySelector(".pc-bpicker")).not.toBeNull();
    // expandSelect race ledger: no toggle column → name, size, speed, source.
    expect(root.querySelectorAll(".pc-btable-head .pc-btable-th").length).toBe(4); // name, size, speed, source
    expect(root.querySelectorAll(".pc-btoggle").length).toBe(0);
    root.querySelector<HTMLElement>(".pc-btable-row")!.click(); // row click = select
    expect(setRace).toHaveBeenCalledWith("srd-5e_elf");
  });

  it("Finish with Average (default) seeds hit dice + max HP before clearing the draft flag", () => {
    const root = mountContainer();
    const order: string[] = [];
    const editState = {
      seedHitDice: vi.fn(() => order.push("seedHitDice")),
      seedHpToMax: vi.fn(() => order.push("seedHpToMax")),
      setHpMax: vi.fn(() => order.push("setHpMax")),
      finishBuild: vi.fn(() => order.push("finishBuild")),
    };
    const c = {
      ...ctx(),
      resolved: { definition: { name: "Valeria", class: [{ name: "[[srd-5e_fighter]]", level: 1 }] } },
      editState,
      builderUiState: new Map(),
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    root.querySelector<HTMLButtonElement>(".pc-builder-finish")!.click();
    expect(order).toEqual(["seedHitDice", "seedHpToMax", "finishBuild"]);
    expect(editState.setHpMax).not.toHaveBeenCalled();
  });

  it("Finish with Manual 25 seeds hit dice + writes the manual max, NOT seedHpToMax", () => {
    const root = mountContainer();
    const order: string[] = [];
    const editState = {
      seedHitDice: vi.fn(() => order.push("seedHitDice")),
      seedHpToMax: vi.fn(() => order.push("seedHpToMax")),
      setHpMax: vi.fn(() => order.push("setHpMax")),
      finishBuild: vi.fn(() => order.push("finishBuild")),
    };
    const bag = new Map<string, unknown>([["builder.details.hp", { mode: "manual", value: 25 }]]);
    const c = {
      ...ctx(),
      resolved: { definition: { name: "Valeria", class: [{ name: "[[srd-5e_fighter]]", level: 1 }] } },
      editState,
      builderUiState: bag,
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    root.querySelector<HTMLButtonElement>(".pc-builder-finish")!.click();
    expect(order).toEqual(["seedHitDice", "setHpMax", "finishBuild"]);
    expect(editState.setHpMax).toHaveBeenCalledWith(25);
    expect(editState.seedHpToMax).not.toHaveBeenCalled();
  });

  it("Finish with Manual but no/invalid value falls back to Average seeding", () => {
    const root = mountContainer();
    const order: string[] = [];
    const editState = {
      seedHitDice: vi.fn(() => order.push("seedHitDice")),
      seedHpToMax: vi.fn(() => order.push("seedHpToMax")),
      setHpMax: vi.fn(() => order.push("setHpMax")),
      finishBuild: vi.fn(() => order.push("finishBuild")),
    };
    const bag = new Map<string, unknown>([["builder.details.hp", { mode: "manual", value: null }]]);
    const c = {
      ...ctx(),
      resolved: { definition: { name: "Valeria", class: [{ name: "[[srd-5e_fighter]]", level: 1 }] } },
      editState,
      builderUiState: bag,
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    root.querySelector<HTMLElement>(".pc-builder-step[data-step='details']")!.click();
    root.querySelector<HTMLButtonElement>(".pc-builder-finish")!.click();
    expect(order).toEqual(["seedHitDice", "seedHpToMax", "finishBuild"]);
    expect(editState.setHpMax).not.toHaveBeenCalled();
  });

  it("prefixes each rail step with a 1-based numbered circle when nothing is done", () => {
    const root = mountContainer();
    // A definition where every D4 done-predicate is false: no race/class/bg/equipment
    // and a manual all-10 spread → every circle keeps its index, no ✓.
    const c = {
      ...ctx(),
      resolved: {
        definition: {
          name: "Valeria",
          race: null,
          class: [],
          background: null,
          ability_method: "manual",
          abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          equipment: [],
        },
      },
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    const steps = root.querySelectorAll(".pc-builder-step");
    expect(steps.length).toBe(BUILDER_STEPS.length);
    steps.forEach((step, i) => {
      const n = step.querySelector(".pc-builder-step-n");
      expect(n).not.toBeNull();
      expect(n?.textContent).toBe(String(i + 1));
    });
  });

  it("renders the numbered circle inside the active step", () => {
    const root = mountContainer();
    new BuilderView().render(root, ctx());
    const active = root.querySelector(".pc-builder-step.active");
    expect(active?.querySelector(".pc-builder-step-n")).not.toBeNull();
  });

  describe("BuilderView — rail done indicators", () => {
    function railStep(root: HTMLElement, id: string): HTMLElement | null {
      return root.querySelector<HTMLElement>(`.pc-builder-step[data-step='${id}']`);
    }

    it("race/class/background steps show ✓ once their entity is chosen", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: {
            name: "Valeria",
            race: "[[srd-5e_elf]]",
            class: [{ name: "[[srd-5e_fighter]]", level: 1 }],
            background: null,
          },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);

      const race = railStep(root, "race")!;
      expect(race.classList.contains("done")).toBe(true);
      expect(race.querySelector(".pc-builder-step-n")?.textContent).toBe("✓");

      const klass = railStep(root, "class")!;
      expect(klass.classList.contains("done")).toBe(true);
      expect(klass.querySelector(".pc-builder-step-n")?.textContent).toBe("✓");

      const bg = railStep(root, "background")!;
      expect(bg.classList.contains("done")).toBe(false);
      // background is the 4th step → keeps its 1-based number.
      expect(bg.querySelector(".pc-builder-step-n")?.textContent).toBe("4");
    });

    it("abilities shows ✓ when the method is non-manual or any base differs from 10", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: {
            name: "Valeria",
            class: [],
            ability_method: "point-buy",
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const ab = railStep(root, "abilities")!;
      expect(ab.classList.contains("done")).toBe(true);
      expect(ab.querySelector(".pc-builder-step-n")?.textContent).toBe("✓");
    });

    it("abilities stays not-done for a manual all-10 spread", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: {
            name: "Valeria",
            class: [],
            ability_method: "manual",
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const ab = railStep(root, "abilities")!;
      expect(ab.classList.contains("done")).toBe(false);
      expect(ab.querySelector(".pc-builder-step-n")?.textContent).toBe("3");
    });

    it("abilities shows ✓ for a manual spread with any base differing from 10", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: {
            name: "Valeria",
            class: [],
            ability_method: "manual",
            abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const ab = railStep(root, "abilities")!;
      expect(ab.classList.contains("done")).toBe(true);
    });

    it("equipment shows ✓ once it has any entry", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: { name: "Valeria", class: [], equipment: [{ name: "Rope" }] },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const eq = railStep(root, "equipment")!;
      expect(eq.classList.contains("done")).toBe(true);
      expect(eq.querySelector(".pc-builder-step-n")?.textContent).toBe("✓");
    });

    it("details never shows ✓", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        resolved: {
          definition: {
            name: "Valeria",
            race: "[[srd-5e_elf]]",
            class: [{ name: "[[srd-5e_fighter]]", level: 1 }],
            background: "[[srd-5e_acolyte]]",
            ability_method: "point-buy",
            abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
            equipment: [{ name: "Rope" }],
            alignment: "Lawful Good",
            age: "26",
          },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const det = railStep(root, "details")!;
      expect(det.classList.contains("done")).toBe(false);
      // details is the 6th step → keeps its number, never a ✓.
      expect(det.querySelector(".pc-builder-step-n")?.textContent).toBe("6");
    });

    it("the active step keeps the active dress even when done", () => {
      const root = mountContainer();
      const c = {
        ...ctx(),
        activeStepId: "race",
        resolved: { definition: { name: "Valeria", class: [], race: "[[srd-5e_elf]]" } },
        builderUiState: new Map(),
        core: {
          plugin: {},
          entities: { search: () => [{
            slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
            data: { name: "Elf", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
          }] },
          compendiums: { getAll: () => [{ name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" }] },
          modules: { getByEntityType: () => undefined },
        },
      } as unknown as ComponentRenderContext;
      new BuilderView().render(root, c);
      const race = railStep(root, "race")!;
      expect(race.classList.contains("active")).toBe(true);
      expect(race.classList.contains("done")).toBe(true);
      // ✓ replaces the number on the active+done step too.
      expect(race.querySelector(".pc-builder-step-n")?.textContent).toBe("✓");
    });
  });

  it("marks the current race (a [[ref]]) as selected in the picker", () => {
    const root = mountContainer();
    const c = {
      ...ctx(),
      resolved: { definition: { name: "Valeria", class: [], race: "[[srd-5e_elf]]" } },
      builderUiState: new Map(),
      core: {
        plugin: {},
        entities: { search: () => [{
          slug: "srd-5e_elf", name: "Elf", entityType: "race", filePath: "elf.md",
          data: { name: "Elf", edition: "2014" }, compendium: "SRD 5e", readonly: true, homebrew: false,
        }] },
        compendiums: { getAll: () => [{ name: "SRD 5e", description: "", readonly: true, homebrew: false, folderPath: "" }] },
        modules: { getByEntityType: () => undefined },
      },
    } as unknown as ComponentRenderContext;
    new BuilderView().render(root, c);
    // expandSelect race ledger: the chosen race wears the crimson name dress +
    // inline seal instead of a toggle-column seal.
    const name = root.querySelector(".pc-btable-row .pc-btable-name");
    expect(name?.classList.contains("on")).toBe(true);
    expect(root.querySelector(".pc-btable-row .pc-bname-seal")).not.toBeNull();
  });

  describe("BuilderView — class step dispatch, Next gating, rail badge", () => {
    // A registry shaped just enough for the class step + buildDecisionLedger.
    function classRegistry(): unknown {
      const classes = [
        { slug: "bard", name: "Bard", entityType: "class", filePath: "bard.md",
          data: { hit_die: "d8", primary_abilities: ["cha"], features_by_level: {}, edition: "2024" },
          compendium: "SRD", readonly: true, homebrew: false },
        { slug: "warlock", name: "Warlock", entityType: "class", filePath: "warlock.md",
          data: { hit_die: "d8", primary_abilities: ["cha"], features_by_level: {}, edition: "2024" },
          compendium: "SRD", readonly: true, homebrew: false },
      ];
      const all = [...classes];
      return {
        search: (q: string, type: string) =>
          all.filter((e) => e.entityType === type && e.name.toLowerCase().includes(q.toLowerCase())),
        getByTypeAndSlug: (type: string, slug: string) =>
          all.find((e) => e.entityType === type && e.slug === slug),
      };
    }

    function classCtx(opts: {
      activeStepId: string;
      classes: Array<{ name: string; level: number; subclass?: string | null }>;
    }): ComponentRenderContext {
      return {
        ...ctx(),
        app: {},
        activeStepId: opts.activeStepId,
        resolved: {
          definition: { name: "Valeria", class: opts.classes },
          classes: opts.classes.map((c) => ({ entity: null, level: c.level, subclass: null, choices: {} })),
          features: [],
        },
        derived: { totalLevel: 0, proficiencyBonus: 2, scores: {} },
        editState: { addClass: vi.fn(), removeClass: vi.fn(), setClassLevel: vi.fn() },
        builderUiState: new Map(),
        core: {
          plugin: {},
          entities: classRegistry(),
          compendiums: { getAll: () => [{ name: "SRD", description: "", readonly: true, homebrew: false, folderPath: "" }] },
          modules: { getByEntityType: () => undefined },
        },
      } as unknown as ComponentRenderContext;
    }

    it("class step dispatches to the new card-stack host (old level dropdown gone)", () => {
      const root = mountContainer();
      new BuilderView().render(root, classCtx({ activeStepId: "class", classes: [] }));
      expect(root.querySelector(".pc-bcadd")).not.toBeNull(); // new host
      expect(root.querySelector(".pc-bclass-level")).toBeNull(); // old level dropdown gone
    });

    it("Next is disabled with the quiet hint on a class-less Class step", () => {
      const root = mountContainer();
      new BuilderView().render(root, classCtx({ activeStepId: "class", classes: [] }));
      const next = root.querySelector(".pc-builder-next") as HTMLButtonElement;
      expect(next.disabled).toBe(true);
      expect(root.querySelector(".pc-builder-foot-hint")!.textContent).toContain("pick a class");
    });

    it("Next is enabled once a class exists; other steps never gate", () => {
      const root = mountContainer();
      new BuilderView().render(
        root,
        classCtx({ activeStepId: "class", classes: [{ name: "[[bard]]", level: 5 }] }),
      );
      expect((root.querySelector(".pc-builder-next") as HTMLButtonElement).disabled).toBe(false);
      expect(root.querySelector(".pc-builder-foot-hint")).toBeNull();

      const root2 = mountContainer();
      new BuilderView().render(root2, classCtx({ activeStepId: "race", classes: [] }));
      expect((root2.querySelector(".pc-builder-next") as HTMLButtonElement).disabled).toBe(false);
    });

    it("the class rail item carries the classes badge", () => {
      const root = mountContainer();
      new BuilderView().render(
        root,
        classCtx({
          activeStepId: "race",
          classes: [{ name: "[[bard]]", level: 4 }, { name: "[[warlock]]", level: 1 }],
        }),
      );
      expect(
        root.querySelector('[data-step="class"] .pc-builder-step-badge')!.textContent,
      ).toBe("Bard 4 · Warlock 1");
    });
  });
});
