/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { ClassBlock, resolveFeatureDescription } from "../src/modules/pc/blocks/class-block";
import { SubclassBlock } from "../src/modules/pc/blocks/subclass-block";
import { RaceBlock } from "../src/modules/pc/blocks/race-block";
import { BackgroundBlock } from "../src/modules/pc/blocks/background-block";
import { FeatBlock } from "../src/modules/pc/blocks/feat-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function mkResolved(): ResolvedCharacter {
  return {
    definition: { name: "T", edition: "2014", race: "[[hill-folk]]", subrace: null, background: "[[drifter]]", class: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual", skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] }, equipment: [], overrides: {}, state: { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] } },
    race: {
      slug: "hill-folk", name: "Hill Folk", description: "Hill folk are tough.",
      size: "Medium", speed: { walk: 25 }, vision: { darkvision: 60 },
      traits: [{ name: "Stonecunning", description: "You know stone." }],
    } as never,
    classes: [{
      entity: {
        slug: "bladesworn", name: "Bladesworn", hit_die: "d10",
        saving_throws: ["str", "con"], primary_abilities: ["str"],
        features_by_level: {
          1: [{ name: "Sworn Blade", description: "Your weapon is bound." }],
          4: [{ name: "Ability Score Improvement" }],
        },
      } as never,
      level: 3,
      subclass: {
        slug: "path-of-shadow", name: "Path of Shadow", description: "Shadows.",
        features_by_level: { 3: [{ name: "Shadow Step", description: "Teleport." }] },
      } as never,
      choices: { 1: { skills: ["athletics", "perception"], expertise: ["athletics"] } },
    }],
    background: { slug: "drifter", name: "Drifter", description: "Always moving.", skill_proficiencies: ["insight", "survival"], tool_proficiencies: [], language_proficiencies: [], feature: { name: "Wanderer's Way", description: "Travel is easy." } } as never,
    feats: [{ slug: "sure-step", name: "Sure-Step", description: "Difficult terrain is yours.", prerequisites: ["Dex 13"] } as never],
    totalLevel: 3,
    features: [],
    state: {} as never,
  };
}

const ctx = (): ComponentRenderContext => ({
  resolved: mkResolved(),
  derived: {} as DerivedStats,
  core: {} as never,
});

describe("resolveFeatureDescription", () => {
  it("returns base description when no choice", () => {
    expect(resolveFeatureDescription({ name: "X", description: "base" }, undefined)).toBe("base");
  });
  it("appends chosen skills when present", () => {
    const r = resolveFeatureDescription({ name: "X", description: "base" }, { skills: ["athletics"], expertise: ["athletics"] });
    expect(r).toContain("Skills: Athletics");
    expect(r).toContain("Expertise: Athletics");
  });
  it("handles feat choice slug", () => {
    const r = resolveFeatureDescription({ name: "X" }, { feat: "[[sure-step]]" });
    expect(r).toContain("Feat: Sure Step");
  });
});

describe("ClassBlock", () => {
  it("renders a section per class with title including level", () => {
    const container = mountContainer();
    new ClassBlock().render(container, ctx());
    const title = container.querySelector(".pc-class-block .pc-block-title")?.textContent;
    expect(title).toBe("Bladesworn — Level 3");
  });
  it("level-filters features to character level", () => {
    const container = mountContainer();
    new ClassBlock().render(container, ctx());
    const items = [...container.querySelectorAll(".pc-feature-item strong")].map((s) => s.textContent);
    expect(items.some((t) => t?.includes("Level 1"))).toBe(true);
    expect(items.some((t) => t?.includes("Level 4"))).toBe(false);
  });
  it("expands choice values in feature descriptions", () => {
    const container = mountContainer();
    new ClassBlock().render(container, ctx());
    const descs = [...container.querySelectorAll(".pc-feature-desc")].map((d) => d.textContent).join("|");
    expect(descs).toContain("Skills: Athletics, Perception");
  });
});

describe("SubclassBlock", () => {
  it("renders subclass section when character has a subclass", () => {
    const container = mountContainer();
    new SubclassBlock().render(container, ctx());
    expect(container.querySelector(".pc-subclass-block .pc-block-title")?.textContent).toBe("Path of Shadow");
    expect(container.textContent).toContain("Shadow Step");
  });
  it("renders nothing when no subclass", () => {
    const container = mountContainer();
    const c = ctx();
    c.resolved.classes[0].subclass = null;
    new SubclassBlock().render(container, c);
    expect(container.querySelector(".pc-subclass-block")).toBeNull();
  });
});

describe("RaceBlock", () => {
  it("renders race name, size, speed, darkvision, and traits", () => {
    const container = mountContainer();
    new RaceBlock().render(container, ctx());
    const root = container.querySelector(".pc-race-block");
    expect(root?.querySelector(".pc-block-title")?.textContent).toBe("Hill Folk");
    expect(root?.textContent).toContain("25 ft.");
    expect(root?.textContent).toContain("Darkvision");
    expect(root?.textContent).toContain("Stonecunning");
  });
});

describe("BackgroundBlock", () => {
  it("renders background name, skill proficiencies, feature", () => {
    const container = mountContainer();
    new BackgroundBlock().render(container, ctx());
    const root = container.querySelector(".pc-background-block");
    expect(root?.textContent).toContain("Drifter");
    expect(root?.textContent).toContain("Insight");
    expect(root?.textContent).toContain("Wanderer's Way");
  });
});

describe("FeatBlock", () => {
  it("renders one section per feat with prerequisites", () => {
    const container = mountContainer();
    new FeatBlock().render(container, ctx());
    const sections = container.querySelectorAll(".pc-feat-block");
    expect(sections.length).toBe(1);
    expect(sections[0].textContent).toContain("Sure-Step");
    expect(sections[0].textContent).toContain("Dex 13");
  });
  it("renders nothing when no feats", () => {
    const container = mountContainer();
    const c = ctx();
    c.resolved.feats = [];
    new FeatBlock().render(container, c);
    expect(container.querySelector(".pc-feat-block")).toBeNull();
  });
});

describe("V7 inline tags in class features", () => {
  it("renders backtick tags as inline-tag spans inside feature descriptions", () => {
    const container = mountContainer();
    const c = ctx();
    c.resolved.classes[0].entity = {
      ...(c.resolved.classes[0].entity as object),
      features_by_level: {
        1: [{ name: "Shielded Mind", description: "Save against effects (`dc:int`)." }],
      },
    } as never;
    new ClassBlock().render(container, c);
    const tag = container.querySelector(".archivist-stat-tag");
    expect(tag).not.toBeNull();
  });
});
