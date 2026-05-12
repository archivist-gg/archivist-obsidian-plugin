/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { SaveChip } from "../src/modules/pc/components/save-chip";
import { SkillsPanel } from "../src/modules/pc/components/skills-panel";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { ConditionEffects } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const ZERO_EFFECTS: ConditionEffects = {
  speed_multiplier: 1, speed_reduction_ft: 0, speed_floor_zero: false,
  hp_max_multiplier: 1, d20_test_penalty: 0, exhaustion_level: 0,
  attack_disadvantage: false, attack_advantage: false, attack_advantage_against: false,
  ability_check_disadvantage: false, save_disadvantage_dex: false,
  save_autofail_str: false, save_autofail_dex: false, saves_disadvantage_all: false,
  actions_disabled: false, reactions_disabled: false, sources: [],
};

function ctxWith(
  effects: Partial<ConditionEffects>,
  savesOverride: Record<string, { bonus: number; proficient: boolean }> = {},
): ComponentRenderContext {
  return {
    derived: {
      saves: {
        str: { bonus: 5, proficient: true },
        dex: { bonus: 2, proficient: false },
        con: { bonus: 3, proficient: true },
        int: { bonus: 0, proficient: false },
        wis: { bonus: 1, proficient: false },
        cha: { bonus: 0, proficient: false },
        ...savesOverride,
      },
      skills: {
        acrobatics: { bonus: 2, proficiency: "none", ability: "dex" },
        athletics: { bonus: 5, proficiency: "proficient", ability: "str" },
      },
      conditionEffects: { ...ZERO_EFFECTS, ...effects },
    },
    resolved: { definition: { overrides: {} } },
    editState: null,
  } as unknown as ComponentRenderContext;
}

describe("save-chip — AUTO-FAIL rendering", () => {
  it("renders AUTO-FAIL chip and hides bonus when save_autofail_str", () => {
    const root = mountContainer();
    new SaveChip("str").render(root, ctxWith({
      save_autofail_str: true,
      sources: [{ condition: "paralyzed", effects: ["Auto-fail STR/DEX saves."] }],
    }));
    expect(root.querySelector(".pc-cond-tag-fail")?.textContent).toBe("AUTO-FAIL");
    expect((root.querySelector(".pc-save-bn") as HTMLElement).classList.contains("is-hidden")).toBe(true);
  });
  it("renders DIS chip when save_disadvantage_dex on the dex chip", () => {
    const root = mountContainer();
    new SaveChip("dex").render(root, ctxWith({
      save_disadvantage_dex: true,
      sources: [{ condition: "restrained", effects: [] }],
    }));
    expect(root.querySelector(".pc-cond-tag-dis")?.textContent).toBe("DIS");
  });
  it("renders DIS chip on every save when saves_disadvantage_all", () => {
    const root = mountContainer();
    new SaveChip("con").render(root, ctxWith({
      saves_disadvantage_all: true,
      sources: [{ condition: "exhaustion", level: 3, effects: [] }],
    }));
    expect(root.querySelector(".pc-cond-tag-dis")).not.toBeNull();
  });
});

describe("skills-panel — DIS chip", () => {
  it("renders DIS on every skill row when ability_check_disadvantage", () => {
    const root = mountContainer();
    new SkillsPanel().render(root, ctxWith({
      ability_check_disadvantage: true,
      sources: [{ condition: "poisoned", effects: [] }],
    }));
    const rows = root.querySelectorAll(".pc-skill-row");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of Array.from(rows)) {
      expect(row.querySelector(".pc-cond-tag-dis")).not.toBeNull();
    }
  });
  it("does NOT render DIS when no condition flag is set", () => {
    const root = mountContainer();
    new SkillsPanel().render(root, ctxWith({}));
    expect(root.querySelector(".pc-cond-tag-dis")).toBeNull();
  });
});

describe("renderConditionTag — primitive", () => {
  it("renders a tag with the given kind label", async () => {
    const { renderConditionTag } = await import("../src/modules/pc/components/condition-tag");
    const root = mountContainer();
    renderConditionTag(root, "ADV", "test tooltip");
    const tag = root.querySelector(".pc-cond-tag-adv") as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag.textContent).toBe("ADV");
  });
});
