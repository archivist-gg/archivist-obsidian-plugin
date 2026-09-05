/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { type App } from "obsidian";
import {
  renderFeatureCard,
  featureCardDescription,
  resolveFeatureDescription,
  formatSourceLabel,
} from "../packages/obsidian/src/modules/pc/blocks/feature-card";
import { RESET_LABELS } from "../packages/obsidian/src/modules/pc/components/actions/reset-labels";
import type { ResetTrigger } from "@archivist-gg/dnd5e/types/resource";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("featureCardDescription — description ?? entries fallback (§3.4)", () => {
  it("prefers an explicit description", () => {
    expect(featureCardDescription({ name: "X", description: "prose", entries: ["ignored"] })).toBe("prose");
  });
  it("falls back to joined entries when there is no description", () => {
    const d = featureCardDescription({ name: "Racial Trait", entries: ["First para.", "Second para."] });
    expect(d).toBe("First para.\n\nSecond para.");
  });
  it("returns undefined when neither is present", () => {
    expect(featureCardDescription({ name: "X" })).toBeUndefined();
    expect(featureCardDescription(undefined)).toBeUndefined();
  });
});

describe("renderFeatureCard — generalized card", () => {
  it("(a) an entries-only feature renders a NON-EMPTY description", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Invoke Hell",
      app: {} as App,
      feature: { name: "Invoke Hell", entries: ["You call upon infernal power.", "The area erupts in flame."] },
    });
    const desc = root.querySelector(".archivist-item-description");
    expect(desc).toBeTruthy();
    expect(desc?.textContent?.trim().length).toBeGreaterThan(0);
    expect(desc?.textContent).toContain("infernal power");
    // joined paragraphs now render through ONE shared-markdown call → one .description-paragraph
    expect(root.querySelectorAll(".archivist-item-description .description-paragraph").length).toBe(1);
  });

  it("(b) a card with NO die renders NO properties block and NO recovery action", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Stonecunning",
      app: {} as App,
      sourceLabel: "Hill Folk",
      feature: { name: "Stonecunning", description: "You know stone." },
    });
    expect(root.querySelector(".archivist-item-properties")).toBeNull();
    expect(root.querySelector(".archivist-property-line-icon")).toBeNull();
    expect(root.querySelector(".pc-resource-actions")).toBeNull();
    // title + description still render
    expect(root.querySelector(".archivist-item-name")?.textContent).toBe("Stonecunning");
    expect(root.querySelector(".archivist-item-subtitle")?.textContent).toBe("Hill Folk");
    expect(root.querySelector(".archivist-item-description")?.textContent).toContain("know stone");
  });

  it("(c) chosenInline renders \"Chose · <label>: <description>\"", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Combat Mastery",
      app: {} as App,
      feature: { name: "Combat Mastery", description: "Pick a mastery." },
      chosenInline: [{ label: "Lies", description: "use Charisma for melee attack & damage" }],
    });
    const desc = root.querySelector(".archivist-item-description");
    expect(desc?.textContent).toContain("Chose · Lies: use Charisma for melee attack & damage");
    // the base description also survives
    expect(desc?.textContent).toContain("Pick a mastery.");
  });

  it("(c') a chosenInline entry with no description renders \"Chose · <label>\" (no trailing colon, no \"undefined\")", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Combat Mastery",
      app: {} as App,
      chosenInline: [{ label: "Bravado" }],
    });
    const text = root.querySelector(".archivist-item-description")?.textContent ?? "";
    expect(text).toContain("Chose · Bravado");
    expect(text).not.toContain("Chose · Bravado:");
    expect(text).not.toContain("undefined");
  });

  it("renders a card with only chosenInline (no description) — still gets a description container", () => {
    const root = mountContainer();
    renderFeatureCard(root, { title: "Pick", app: {} as App, chosenInline: [{ label: "A" }] });
    expect(root.querySelector(".archivist-item-description")).toBeTruthy();
  });
});

describe("renderRecoveryAction · the spent hint (R4-G3a Task 5)", () => {
  // The ONE reader of the retired `RESET_LABEL` twin, now reading `RESET_LABELS`.
  // Reached through the PUBLIC render path: `renderFeatureCard` calls
  // `renderRecoveryAction` whenever `opts.recovery` is present, and that function
  // short-circuits to the hint when the resource's own use is spent
  // (`fu.used >= fu.max`). `ctx` is untouched on that branch, so the fixture
  // passes a stub. The resource MUST author a `recovery[]` entry and an `id` or
  // the whole action area is skipped.
  //
  // R4-G4 §7.2.3 (the THIRD moved pin): the entry carries `restores: "spell-slots"`
  // EXPLICITLY (invariant 12: kind gates the arm before flavour, so this is what keeps
  // the Wizard fixture on the slot picker), and its `name` is the shipped carrier's
  // "Recover spell slots" because the picker's head now renders `rec.name` rather than
  // a literal. The head assertion below did not move.
  const spentCard = (reset: ResetTrigger): HTMLElement => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Arcane Recovery",
      app: {} as App,
      feature: { name: "Arcane Recovery", description: "x" },
      recovery: {
        resource: {
          id: "wizard:arcane-recovery", name: "Arcane Recovery", max_formula: "1",
          reset, recovery: [{ id: "wizard:arcane-recovery:rec", name: "Recover spell slots", amount: "1", reset, restores: "spell-slots" }],
        },
        source: { kind: "class", slug: "wizard", level: 1 },
        ctx: {} as never,
        fu: { used: 1, max: 1 },
      },
    });
    return root;
  };

  it("pins the spent-hint TEXT, label and glyph included", () => {
    const root = spentCard("long-rest");
    const hint = root.querySelector(".pc-recover-hint");
    expect(hint?.textContent).toBe("Already used · recharges on a Long Rest.");
    // The label half comes from the single table, not from a literal here.
    expect(hint?.textContent).toContain(RESET_LABELS["long-rest"]);
    // The interactive picker is suppressed in the spent state. `.pc-recover-foot`
    // (the Recover button row) is emitted ONLY on the interactive path, so this
    // absence discriminates; `.pc-recover-pip` would not (the renderer spells it
    // `pc-recover-pips`, so a query for it is null on BOTH paths).
    expect(root.querySelector(".pc-recover-foot")).toBeNull();
    expect(root.querySelector(".pc-recover-title")?.textContent).toBe("Recover spell slots");
  });

  it("reads the SAME table for a trigger the retired twin used to mislabel", () => {
    // `dusk` reached "/ Long Rest" through the retired bucket hop; the twin in
    // this file had "Dusk" all along, so this pins that the merge kept the right one.
    expect(spentCard("dusk").querySelector(".pc-recover-hint")?.textContent)
      .toBe("Already used · recharges on a Dusk.");
  });
});

describe("renderRecoveryAction · the two arms, by KIND then FLAVOUR (R4-G4 §7.3)", () => {
  // The card is reached through the PUBLIC render path (`renderFeatureCard` calls
  // `renderRecoveryAction` whenever `opts.recovery` is present). `ctx.resolved` carries a
  // `state` because the slot arm reads `state.spell_slots`; `editState` is the double the
  // uses arm calls.
  const card = (resource: object, fu: { used: number; max: number }, editState: object = {}) => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "x", app: {} as App, feature: { name: "x", description: "x" },
      recovery: {
        resource: resource as never,
        source: { kind: "class", slug: "c", level: 1 },
        ctx: {
          resolved: { state: { spell_slots: {}, feature_uses: {} }, classes: [], totalLevel: 3 },
          derived: { proficiencyBonus: 2, mods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } },
          editState,
        } as never,
        fu,
      },
    });
    return root;
  };

  it("RED FIRST: a rest-flavour uses entry (Second Wind) renders NO 'Recover spell slots' and NO button", () => {
    const root = card({ id: "f:sw", name: "Second Wind", max_formula: "2", reset: "long-rest",
      recovery: [{ id: "r", name: "short-rest", amount: 1, reset: "short-rest" }] }, { used: 1, max: 2 });
    // m19's RED FIRST: under the mutant the uses arm renders "Regain 1 Second Wind".
    expect(root.textContent).not.toContain("Regain");
    expect(root.textContent).not.toContain("Recover spell slots");
    expect(root.querySelector("button")).toBeNull();
  });

  it("RED FIRST: a manual uses entry (TCE Psi Warrior) renders 'Regain 1 Psionic Energy Die' with the bonus-action badge and the reset caption, and clicks through", () => {
    const regain = vi.fn();
    const root = card({ id: "f:pd", name: "Psionic Energy Die", max_formula: "2 * prof", reset: "long-rest",
      recovery: [{ id: "r", name: "short-rest", amount: 1, reset: "short-rest", action: "bonus-action" }] }, { used: 2, max: 4 }, { regainFeatureUses: regain });
    const btn = root.querySelector<HTMLButtonElement>("button.pc-regain")!;
    expect(btn.textContent).toBe("Regain 1 Psionic Energy Die");
    // `renderCostBadge` prints the SHARED `ACTION_COST_LABEL` string, which is "Bonus".
    expect(root.querySelector(".pc-regain-cost")!.textContent).toBe("Bonus");
    expect(root.querySelector(".pc-regain-reset")!.textContent).toBe("Short Rest");
    btn.click();
    expect(regain).toHaveBeenCalledWith("f:pd", 1);
  });

  it("'all' + custom restores everything and is a MANUAL OVERRIDE (said so); disabled at used 0; prose renders no button", () => {
    const root = card({ id: "f:x", name: "Power Surge", max_formula: "1", reset: "long-rest",
      recovery: [{ id: "r", name: "custom", amount: "all", reset: "custom" }] }, { used: 1, max: 1 }, { regainFeatureUses: vi.fn() });
    expect(root.querySelector("button.pc-regain")!.textContent).toBe("Regain all Power Surge");
    expect(root.querySelector(".pc-regain-note")!.textContent).toContain("manual override");
    const idle = card({ id: "f:y", name: "Y", max_formula: "1", reset: "long-rest", recovery: [{ id: "r", name: "custom", amount: 1, reset: "custom" }] }, { used: 0, max: 1 });
    expect(idle.querySelector<HTMLButtonElement>("button.pc-regain")!.disabled).toBe(true);
    const prose = card({ id: "f:z", name: "Arcane Ward", max_formula: "1", reset: "long-rest", recovery: [{ id: "r", name: "custom", amount: "twice the spell's level", reset: "custom" }] }, { used: 1, max: 1 });
    expect(prose.querySelector("button.pc-regain")).toBeNull();
    expect(prose.querySelector(".pc-regain-note")!.textContent).toContain("twice the spell's level");
  });
});

describe("relocated helpers", () => {
  it("formatSourceLabel formats each source kind", () => {
    expect(formatSourceLabel({ kind: "class", slug: "battle-master", level: 3 })).toBe("Battle Master 3");
    expect(formatSourceLabel({ kind: "race", slug: "hill-folk" })).toBe("Hill Folk");
    expect(formatSourceLabel({ kind: "background", slug: "drifter" })).toBe("Background: Drifter");
    expect(formatSourceLabel({ kind: "feat", slug: "sure-step" })).toBe("Feat: Sure Step");
    expect(formatSourceLabel(undefined)).toBe("");
  });

  // R4-G3a §8.2 (3): the `RESET_LABEL` twin that used to live in feature-card.ts
  // is retired onto the single `RESET_LABELS` table; these two pins move with it.
  it("RESET_LABELS maps reset triggers to friendly labels", () => {
    expect(RESET_LABELS["short-rest"]).toBe("Short Rest");
    expect(RESET_LABELS["long-rest"]).toBe("Long Rest");
  });

  it("resolveFeatureDescription returns the base and appends chosen picks", () => {
    expect(resolveFeatureDescription({ name: "X", description: "base" }, undefined)).toBe("base");
    const r = resolveFeatureDescription({ name: "X", description: "base" }, { skills: ["athletics"] });
    expect(r).toContain("Skills: Athletics");
  });
});
