/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ProficienciesPanel, aggregateProficiencies } from "../src/modules/pc/components/proficiencies-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ResolvedCharacter, DerivedStats } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function mkResolved(): ResolvedCharacter {
  return {
    definition: {} as never,
    race: { slug: "hill-folk", languages: ["common", "dwarvish"] } as never,
    classes: [{
      entity: {
        slug: "bladesworn",
        proficiencies: {
          armor: ["light", "medium", "shield"],
          weapons: { fixed: ["longsword"], categories: ["simple"] },
          tools: { fixed: ["smiths-tools"] },
        },
      } as never,
      level: 5, subclass: null, choices: {},
    }],
    background: { slug: "drifter", proficiencies: { tools: ["dice-set"], languages: ["thieves-cant"] } } as never,
    feats: [],
    totalLevel: 5,
    features: [],
    state: {} as never,
  };
}

describe("aggregateProficiencies", () => {
  it("merges class + race + background proficiencies", () => {
    const agg = aggregateProficiencies(mkResolved());
    expect(agg.armor).toEqual(["Light", "Medium", "Shield"]);
    expect(agg.weapons).toEqual(["Longsword", "Simple"]);
    expect(agg.tools).toEqual(["Dice Set", "Smiths Tools"]);
    expect(agg.languages).toEqual(["Common", "Dwarvish", "Thieves Cant"]);
  });
  it("dedupes across sources", () => {
    const r = mkResolved();
    (r.race as unknown as { languages?: string[] }).languages = ["common", "thieves-cant"];
    expect(aggregateProficiencies(r).languages).toEqual(["Common", "Thieves Cant"]);
  });
});

describe("ProficienciesPanel", () => {
  const ctx: ComponentRenderContext = {
    resolved: mkResolved(),
    derived: {} as DerivedStats,
    core: {} as never,
  };
  it("renders four labelled lines", () => {
    const container = mountContainer();
    new ProficienciesPanel().render(container, ctx);
    const lines = container.querySelectorAll(".pc-prof-line");
    expect(lines.length).toBe(4);
    const keys = [...container.querySelectorAll(".pc-prof-key")].map((k) => k.textContent);
    expect(keys).toEqual(["Armor: ", "Weapons: ", "Tools: ", "Languages: "]);
  });
  it("shows dash when category is empty", () => {
    const r = mkResolved();
    r.feats = [];
    r.classes[0].entity = {
      slug: "x",
      proficiencies: { armor: [], weapons: { fixed: [] }, tools: { fixed: [] } },
    } as never;
    r.background = null;
    r.race = null;
    const container = mountContainer();
    new ProficienciesPanel().render(container, { resolved: r, derived: {} as DerivedStats, core: {} as never });
    const vals = [...container.querySelectorAll(".pc-prof-vals")].map((v) => v.textContent);
    expect(vals).toEqual(["—", "—", "—", "—"]);
  });
});
