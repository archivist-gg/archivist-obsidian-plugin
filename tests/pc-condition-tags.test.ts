/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { SaveChip } from "../packages/obsidian/src/modules/pc/components/save-chip";
import { SkillsPanel } from "../packages/obsidian/src/modules/pc/components/skills-panel";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { HpWidget } from "../packages/obsidian/src/modules/pc/components/hp-widget";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ConditionEffects } from "@archivist-gg/dnd5e/pc/pc.types";

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
  it("on auto-fail shows a — placeholder (separate element) and keeps .pc-save-bn hidden", () => {
    const root = mountContainer();
    new SaveChip("str").render(root, ctxWith({
      save_autofail_str: true,
      sources: [{ condition: "paralyzed", effects: ["Auto-fail STR/DEX saves."] }],
    }));
    expect((root.querySelector(".pc-save-bn") as HTMLElement).classList.contains("is-hidden")).toBe(true);
    expect(root.querySelector(".pc-save-dash")!.textContent).toBe("—");
    expect(root.querySelector(".pc-save-tags .pc-cond-tag-fail")).toBeTruthy();
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
    const { renderConditionTag } = await import("../packages/obsidian/src/modules/pc/components/condition-tag");
    const root = mountContainer();
    renderConditionTag(root, "ADV", "test tooltip");
    const tag = root.querySelector(".pc-cond-tag-adv") as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag.textContent).toBe("ADV");
  });
  it("renders cond-tags with the shared .pc-meta-chip base alongside .pc-cond-tag", async () => {
    const { renderConditionTag } = await import("../packages/obsidian/src/modules/pc/components/condition-tag");
    const root = mountContainer();
    renderConditionTag(root, "ADV", "x");
    const tag = root.querySelector(".pc-cond-tag")!;
    expect(tag.classList.contains("pc-meta-chip")).toBe(true);
    expect(tag.classList.contains("pc-cond-tag-adv")).toBe(true);
  });
});

function actionsTabCtxWith(effects: Partial<ConditionEffects>): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      features: [],
      state: {} as never,
    } as never,
    derived: {
      attacks: [],
      conditionEffects: { ...ZERO_EFFECTS, ...effects },
    } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: null,
  };
}

describe("actions-tab — Incapacitated banner", () => {
  it("renders banner when actions_disabled is true", () => {
    const root = mountContainer();
    new ActionsTab().render(root, actionsTabCtxWith({
      actions_disabled: true,
      reactions_disabled: true,
      sources: [{ condition: "incapacitated", effects: ["Can't take actions or reactions."] }],
    }));
    const banner = root.querySelector(".pc-incapacitated-banner") as HTMLElement | null;
    expect(banner).not.toBeNull();
    expect(banner?.querySelector(".pc-incapacitated-banner-status")?.textContent).toBe("Incapacitated");
    expect(banner?.querySelector(".pc-incapacitated-banner-effect")?.textContent).toBe("actions & reactions disabled");
  });
  it("does NOT render banner when actions_disabled is false", () => {
    const root = mountContainer();
    new ActionsTab().render(root, actionsTabCtxWith({}));
    expect(root.querySelector(".pc-incapacitated-banner")).toBeNull();
  });
});

describe("hp-widget — exhaustion death overlay", () => {
  it("renders DEAD (Exhaustion 6) overlay when exhaustion_level >= 6", () => {
    const root = mountContainer();
    const ctx = ctxWith({ exhaustion_level: 6, sources: [{ condition: "exhaustion", level: 6, effects: [] }] }) as never;
    (ctx as Record<string, unknown>).derived = {
      ...((ctx as { derived: Record<string, unknown> }).derived),
      hp: { current: 10, max: 10, temp: 0 },
    };
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget.dead")).not.toBeNull();
    expect(root.textContent).toContain("DEAD (Exhaustion 6)");
  });
  it("renders normal HIT POINTS when no exhaustion and HP > 0", () => {
    const root = mountContainer();
    const ctx = ctxWith({}) as never;
    (ctx as Record<string, unknown>).derived = {
      ...((ctx as { derived: Record<string, unknown> }).derived),
      hp: { current: 10, max: 10, temp: 0 },
    };
    new HpWidget().render(root, ctx);
    expect(root.querySelector(".pc-hp-widget.dead")).toBeNull();
    expect(root.textContent).toContain("HIT POINTS");
  });
});
