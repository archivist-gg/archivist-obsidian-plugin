/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { SkillsPanel } from "../src/modules/pc/components/skills-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";
import type { SkillSlug } from "../src/shared/types";

beforeAll(() => installObsidianDomHelpers());

const ALL_SKILL_SLUGS: SkillSlug[] = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
];

function mkSkills(partial: Partial<Record<SkillSlug, { bonus: number; proficiency: "none" | "proficient" | "expertise"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha" }>>): DerivedStats["skills"] {
  const out = {} as DerivedStats["skills"];
  for (const s of ALL_SKILL_SLUGS) {
    (out as Record<string, unknown>)[s] = partial[s] ?? { bonus: 0, proficiency: "none", ability: "dex" };
  }
  return out;
}

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {
    skills: mkSkills({
      stealth: { bonus: 10, proficiency: "expertise", ability: "dex" },
      athletics: { bonus: 5, proficiency: "proficient", ability: "str" },
      perception: { bonus: 2, proficiency: "none", ability: "wis" },
    }),
  } as DerivedStats,
  core: {} as never,
};

describe("SkillsPanel", () => {
  it("renders 18 skill rows", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    expect(container.querySelectorAll(".pc-skill-row").length).toBe(18);
  });

  it("rows are alphabetical by display name", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const names = [...container.querySelectorAll(".pc-skill-name")].map((n) => n.textContent);
    expect(names[0]).toBe("Acrobatics");
    expect(names[1]).toBe("Animal Handling");
    expect(names.at(-1)).toBe("Survival");
  });

  it("expertise skills get both .filled and .expertise dot classes", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const row = container.querySelector<HTMLDivElement>('[data-skill="stealth"]');
    const dot = row?.querySelector(".pc-prof-dot");
    expect(dot?.classList.contains("expertise")).toBe(true);
    expect(dot?.classList.contains("filled")).toBe(true);
  });

  it("proficient-but-not-expertise skills get only .filled", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const dot = container.querySelector<HTMLDivElement>('[data-skill="athletics"]')?.querySelector(".pc-prof-dot");
    expect(dot?.classList.contains("filled")).toBe(true);
    expect(dot?.classList.contains("expertise")).toBe(false);
  });

  it("non-proficient skills have a bare dot", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const dot = container.querySelector<HTMLDivElement>('[data-skill="perception"]')?.querySelector(".pc-prof-dot");
    expect(dot?.classList.contains("filled")).toBe(false);
  });
});
