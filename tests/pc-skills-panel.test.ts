/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { SkillsPanel } from "../packages/obsidian/src/modules/pc/components/skills-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import type { SkillSlug } from "@archivist-gg/dnd5e";

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
  services: {} as never,
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

describe("SkillsPanel — roll-modifier chips", () => {
  function ctxWithRollModifiers(rollModifiers: unknown[]): ComponentRenderContext {
    return {
      resolved: {} as ResolvedCharacter,
      derived: {
        skills: mkSkills({
          deception: { bonus: 3, proficiency: "proficient", ability: "cha" },
        }),
        rollModifiers,
      } as unknown as DerivedStats,
      services: {} as never,
      editState: null,
    };
  }

  it("renders an ADV chip on the scoped skill row only", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithRollModifiers([
      { mode: "advantage", roll: "ability-check", scope: "deception", label: "Honeyed Tongue" },
    ]));
    const decRow = container.querySelector<HTMLElement>('[data-skill="deception"]')!;
    expect(decRow.querySelector(".pc-cond-tag.pc-cond-tag-adv")?.textContent).toBe("ADV");
    // A different skill row gets no chip.
    const stealthRow = container.querySelector<HTMLElement>('[data-skill="stealth"]')!;
    expect(stealthRow.querySelector(".pc-cond-tag")).toBeNull();
  });

  it("renders an unscoped ability-check modifier on every skill row", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithRollModifiers([
      { mode: "disadvantage", roll: "ability-check", label: "Some Effect" },
    ]));
    const rows = container.querySelectorAll(".pc-skill-row");
    for (const row of rows) {
      expect(row.querySelector(".pc-cond-tag.pc-cond-tag-dis")?.textContent).toBe("DIS");
    }
  });

  it("does NOT render attack- or saving-throw-scope modifiers as skill chips", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithRollModifiers([
      { mode: "advantage", roll: "attack", label: "Pack Tactics" },
      { mode: "advantage", roll: "saving-throw", scope: "con", label: "Brave" },
    ]));
    expect(container.querySelector(".pc-cond-tag")).toBeNull();
  });
});

/**
 * R4-G3a §6 — the new `mode` members on skill rows, and the ABILITY-KEY scope match.
 *
 * `normalizeRollScope` maps "Strength checks" to the ability key "str", not to a skill slug, so
 * the panel must also match an ability-key scope against the row's OWN ability. The obvious
 * shortcut (`SKILL_ABILITY[skillSlug]`) is WRONG: that table is keyed by space-separated display
 * names ("animal handling"), so it returns undefined for `animal-handling` and `sleight-of-hand`
 * and those two rows would silently never match. `ctx.derived.skills[slug].ability` is the
 * already-in-scope, correctly-keyed source — the two multi-word rows below are that control.
 */
describe("SkillsPanel — roll-modifier chips: new modes + ability-key scope (R4-G3a §6)", () => {
  function ctxWithScopedSkills(rollModifiers: unknown[]): ComponentRenderContext {
    return {
      resolved: {} as ResolvedCharacter,
      derived: {
        skills: mkSkills({
          athletics: { bonus: 5, proficiency: "proficient", ability: "str" },
          investigation: { bonus: 3, proficiency: "proficient", ability: "int" },
          "sleight-of-hand": { bonus: 4, proficiency: "proficient", ability: "dex" },
          "animal-handling": { bonus: 2, proficiency: "none", ability: "wis" },
        }),
        rollModifiers,
      } as unknown as DerivedStats,
      services: {} as never,
      app: {} as never,
      editState: null,
    };
  }

  it('renders "+D4" on the scoped skill row only (add-d4)', () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithScopedSkills([
      { mode: "add-d4", roll: "ability-check", scope: "investigation", label: "Vedalken Dispassion" },
    ]));
    const inv = container.querySelector<HTMLElement>('[data-skill="investigation"]')!;
    expect(inv.querySelector(".pc-cond-tag.pc-cond-tag-rider")?.textContent).toBe("+D4");
    expect(container.querySelector<HTMLElement>('[data-skill="athletics"]')!.querySelector(".pc-cond-tag")).toBeNull();
  });

  it('an ability-key scope "str" renders on Athletics (the STR row)', () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithScopedSkills([
      { mode: "advantage", roll: "ability-check", scope: "str", label: "Enlarge" },
    ]));
    expect(container.querySelector<HTMLElement>('[data-skill="athletics"]')!
      .querySelector(".pc-cond-tag.pc-cond-tag-adv")?.textContent).toBe("ADV");
    expect(container.querySelector<HTMLElement>('[data-skill="investigation"]')!.querySelector(".pc-cond-tag")).toBeNull();
  });

  it('an ability-key scope "dex" reaches the multi-word slug Sleight of Hand', () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithScopedSkills([
      { mode: "advantage", roll: "ability-check", scope: "dex", label: "Cat's Grace" },
    ]));
    expect(container.querySelector<HTMLElement>('[data-skill="sleight-of-hand"]')!
      .querySelector(".pc-cond-tag.pc-cond-tag-adv")?.textContent).toBe("ADV");
    expect(container.querySelector<HTMLElement>('[data-skill="animal-handling"]')!.querySelector(".pc-cond-tag")).toBeNull();
  });

  it('an ability-key scope "wis" reaches the multi-word slug Animal Handling', () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithScopedSkills([
      { mode: "advantage", roll: "ability-check", scope: "wis", label: "Guidance" },
    ]));
    expect(container.querySelector<HTMLElement>('[data-skill="animal-handling"]')!
      .querySelector(".pc-cond-tag.pc-cond-tag-adv")?.textContent).toBe("ADV");
    expect(container.querySelector<HTMLElement>('[data-skill="sleight-of-hand"]')!.querySelector(".pc-cond-tag")).toBeNull();
  });

  // Render half of §14 row 19: a residual prose scope matches no row. (The fold half is dnd5e's —
  // this fixture is hand-built and never runs applyEffect.)
  it("a RESIDUAL prose scope renders no chip on any skill row (pass-through control)", () => {
    const container = mountContainer();
    new SkillsPanel().render(container, ctxWithScopedSkills([
      { mode: "advantage", roll: "ability-check", scope: "Initiative rolls", label: "Feral Instinct" },
    ]));
    expect(container.querySelector(".pc-cond-tag")).toBeNull();
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
