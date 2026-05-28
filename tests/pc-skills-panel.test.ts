/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
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
  editState: null,
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
    const dot = row?.querySelector(".archivist-prof-toggle");
    expect(dot?.classList.contains("expertise")).toBe(true);
    expect(dot?.classList.contains("proficient")).toBe(false);
  });

  it("proficient-but-not-expertise skills get only .filled", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const dot = container.querySelector<HTMLDivElement>('[data-skill="athletics"]')?.querySelector(".archivist-prof-toggle");
    expect(dot?.classList.contains("proficient")).toBe(true);
    expect(dot?.classList.contains("expertise")).toBe(false);
  });

  it("non-proficient skills have a bare dot", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctx);
    const dot = container.querySelector<HTMLDivElement>('[data-skill="perception"]')?.querySelector(".archivist-prof-toggle");
    expect(dot?.classList.contains("proficient")).toBe(false);
    expect(dot?.classList.contains("expertise")).toBe(false);
  });
});

describe("SkillsPanel — interactive (SP4)", () => {
  function interactiveCtx(skills: Record<string, { bonus: number; proficiency: "none" | "proficient" | "expertise"; ability: string }>) {
    const editState = { cycleSkill: vi.fn() };
    return {
      ctx: {
        derived: { skills },
        resolved: { state: { conditions: [] } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("row click calls cycleSkill with the skill slug", () => {
    const root = mountContainer();
    const skills = {
      arcana: { bonus: 0, proficiency: "none" as const, ability: "int" },
    };
    const { ctx, editState } = interactiveCtx(skills);
    new SkillsPanel().render(root, ctx);
    const row = root.querySelector<HTMLElement>("[data-skill='arcana']")!;
    row.click();
    expect(editState.cycleSkill).toHaveBeenCalledWith("arcana");
  });
});

describe("SkillsPanel — bonus split-click overrides (SP4c)", () => {
  function interactiveCtxOverrides(opts: {
    skillSlug: string;
    bonus: number;
    proficiency?: "none" | "proficient" | "expertise";
    overrides?: Partial<Record<string, { bonus: number }>>;
  }) {
    const editState = {
      cycleSkill: vi.fn(),
      setSkillBonusOverride: vi.fn(),
      clearSkillBonusOverride: vi.fn(),
    };
    const skills = {} as Record<string, { bonus: number; proficiency: "none" | "proficient" | "expertise"; ability: string }>;
    for (const slug of ALL_SKILL_SLUGS) {
      skills[slug] = slug === opts.skillSlug
        ? { bonus: opts.bonus, proficiency: opts.proficiency ?? "none", ability: "str" }
        : { bonus: 0, proficiency: "none", ability: "dex" };
    }
    return {
      ctx: {
        derived: { skills },
        resolved: { definition: { overrides: { skills: opts.overrides } } },
        editState,
      } as unknown as ComponentRenderContext,
      editState,
    };
  }

  it("clicking the bonus span opens an inline number input", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtxOverrides({ skillSlug: "athletics", bonus: 5 });
    new SkillsPanel().render(root, ctx);
    const row = root.querySelector<HTMLElement>("[data-skill='athletics']")!;
    const bonusEl = row.querySelector<HTMLElement>(".pc-skill-bonus")!;
    bonusEl.click();
    const input = row.querySelector<HTMLInputElement>("input.pc-edit-inline");
    expect(input).not.toBeNull();
    expect(input!.value).toBe("5");
  });

  it("clicking the bonus span does NOT trigger row cycle (stopPropagation)", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtxOverrides({ skillSlug: "athletics", bonus: 5 });
    new SkillsPanel().render(root, ctx);
    const bonusEl = root.querySelector<HTMLElement>("[data-skill='athletics'] .pc-skill-bonus")!;
    bonusEl.click();
    expect(editState.cycleSkill).not.toHaveBeenCalled();
  });

  it("clicking elsewhere on the row still cycles proficiency", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtxOverrides({ skillSlug: "athletics", bonus: 5 });
    new SkillsPanel().render(root, ctx);
    const nameEl = root.querySelector<HTMLElement>("[data-skill='athletics'] .pc-skill-name")!;
    nameEl.click();
    expect(editState.cycleSkill).toHaveBeenCalledWith("athletics");
  });

  it("override mark renders inside .pc-skill-bonus when override is set", () => {
    const root = mountContainer();
    const { ctx } = interactiveCtxOverrides({
      skillSlug: "athletics",
      bonus: 12,
      overrides: { athletics: { bonus: 12 } },
    });
    new SkillsPanel().render(root, ctx);
    const bonusEl = root.querySelector<HTMLElement>("[data-skill='athletics'] .pc-skill-bonus")!;
    expect(bonusEl.querySelector(".archivist-override-mark")).not.toBeNull();
    // Other rows have no mark.
    const otherBonus = root.querySelector<HTMLElement>("[data-skill='arcana'] .pc-skill-bonus")!;
    expect(otherBonus.querySelector(".archivist-override-mark")).toBeNull();
  });

  it("clicking the override mark calls clearSkillBonusOverride and stops propagation", () => {
    const root = mountContainer();
    const { ctx, editState } = interactiveCtxOverrides({
      skillSlug: "athletics",
      bonus: 12,
      overrides: { athletics: { bonus: 12 } },
    });
    new SkillsPanel().render(root, ctx);
    const mark = root.querySelector<HTMLElement>("[data-skill='athletics'] .archivist-override-mark")!;
    mark.click();
    expect(editState.clearSkillBonusOverride).toHaveBeenCalledWith("athletics");
    expect(editState.cycleSkill).not.toHaveBeenCalled();
  });
});
