/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DefensesConditionsPanel } from "../packages/obsidian/src/modules/pc/components/defenses-conditions-panel";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

type Defenses = ComponentRenderContext["derived"]["defenses"];
type DefenseEntry = Defenses["resistances"][number];
type DefenseOrigin = DefenseEntry["origin"];

/**
 * Seed a bucket with `DefenseEntry` objects. `value` is the canonical slug the
 * mutators key on; `label` is the first-spelling-wins display string. These seeds
 * use the same string for both, which is what the buckets held before R4-P5
 * reshaped them from `string[]`.
 */
function ents(...vals: string[]): DefenseEntry[] {
  return vals.map((v) => ({ value: v, label: v, origin: "manual" as const }));
}

/**
 * One entry whose AUTHORED spelling differs from the canonical slug, with a settable
 * origin. `ents` above can express neither: while every fixture in this file used it no
 * assertion could tell which of the two fields the panel read (the `entry.value` →
 * `entry.label` mutation on both mutator call sites was measured surviving the whole
 * suite), and every entry it seeds is `origin: "manual"`.
 */
function ent(value: string, label: string, origin: DefenseOrigin = "grant"): DefenseEntry {
  return { value, label, origin };
}

function ctx(p: { defenses?: Defenses; conditions?: string[]; exhaustion?: number; editState?: unknown } = {}): ComponentRenderContext {
  return {
    derived: {
      defenses: p.defenses ?? {
        resistances: ents(), immunities: ents(), vulnerabilities: ents(), condition_immunities: ents(),
      },
    },
    resolved: { state: { conditions: p.conditions ?? [], exhaustion: p.exhaustion ?? 0 } },
    editState: p.editState,
  } as unknown as ComponentRenderContext;
}

describe("DefensesConditionsPanel", () => {
  it("wraps both columns in a single .pc-panel with merged class", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelectorAll(".pc-panel.pc-def-cond").length).toBe(1);
    expect(root.querySelectorAll(".pc-def-cond-left").length).toBe(1);
    expect(root.querySelectorAll(".pc-def-cond-right").length).toBe(1);
  });

  it("renders all four property-lines when all populated", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: ents("fire", "cold"),
        immunities: ents("poison"),
        vulnerabilities: ents("radiant"),
        condition_immunities: ents("charmed"),
      },
    }));
    const left = root.querySelector(".pc-def-cond-left");
    expect(left?.textContent).toContain("Damage Resistances");
    expect(left?.textContent).toContain("fire");
    expect(left?.textContent).toContain("cold");
    expect(left?.textContent).toContain("Damage Immunities");
    expect(left?.textContent).toContain("poison");
    expect(left?.textContent).toContain("Damage Vulnerabilities");
    expect(left?.textContent).toContain("radiant");
    expect(left?.textContent).toContain("Condition Immunities");
    // Condition immunities display as PascalCase name (matches condition chips in right pane)
    expect(left?.textContent).toContain("Charmed");
  });

  it("renders active condition chips + static + button", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ conditions: ["prone", "poisoned"] }));
    const chips = [...root.querySelectorAll(".pc-cond-chip")];
    // Chip label is the PascalCase display name (Bug 5)
    expect(chips.map((c) => c.querySelector(".pc-cond-chip-label")?.textContent)).toEqual([
      "Prone",
      "Poisoned",
    ]);
    expect(root.querySelector("button.pc-cond-add")?.textContent).toBe("+");
  });

  it("each chip mounts an svg icon (Bug 5)", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ conditions: ["poisoned"] }));
    const chip = root.querySelector(".pc-cond-chip");
    expect(chip?.querySelector(".pc-cond-chip-icon svg")).not.toBeNull();
  });

  it("shows 'no active conditions' placeholder when empty, still renders + button", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelector(".pc-cond-empty")?.textContent).toBe("no active conditions");
    expect(root.querySelector("button.pc-cond-add")).not.toBeNull();
  });

  it("renders an exhaustion chip when state.exhaustion > 0 (Bug 4)", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 5 }));
    const chip = root.querySelector(".pc-cond-chip-exhaustion");
    expect(chip).not.toBeNull();
    expect(chip?.querySelector(".pc-cond-chip-label")?.textContent).toBe("Exhaustion 5");
    // Exhaustion icon mounts an svg
    expect(chip?.querySelector(".pc-cond-chip-icon svg")).not.toBeNull();
    // Empty placeholder must not appear when exhaustion is non-zero
    expect(root.querySelector(".pc-cond-empty")).toBeNull();
  });

  it("does NOT render exhaustion chip when level is 0", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 0 }));
    expect(root.querySelector(".pc-cond-chip-exhaustion")).toBeNull();
  });

  it("renders both exhaustion and condition chips together", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ exhaustion: 2, conditions: ["prone"] }));
    expect(root.querySelector(".pc-cond-chip-exhaustion .pc-cond-chip-label")?.textContent).toBe("Exhaustion 2");
    const cond = [...root.querySelectorAll(".pc-cond-chip:not(.pc-cond-chip-exhaustion)")];
    expect(cond.length).toBe(1);
    expect(cond[0].querySelector(".pc-cond-chip-label")?.textContent).toBe("Prone");
  });
});

describe("DefensesConditionsPanel — editable left pane (SP4b)", () => {
  it("empty state: renders 'no active defenses' + single + button on the title row", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({ editState: {} }));
    const left = root.querySelector(".pc-def-cond-left")!;
    expect(left.querySelector(".pc-def-empty")?.textContent).toBe("no active defenses");
    // Single + button (head-level), no per-kind labels when empty
    expect(left.querySelectorAll(".pc-def-add-main").length).toBe(1);
    expect(left.textContent).not.toContain("Damage Resistances");
    expect(left.textContent).not.toContain("Condition Immunities");
  });

  it("populated state: renders only non-empty kind rows (hides empty ones)", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: ents("fire"),
        immunities: ents(),
        vulnerabilities: ents(),
        condition_immunities: ents("charmed"),
      },
      editState: {},
    }));
    const left = root.querySelector(".pc-def-cond-left")!;
    expect(left.textContent).toContain("Damage Resistances");
    expect(left.textContent).toContain("Condition Immunities");
    expect(left.textContent).not.toContain("Damage Immunities");
    expect(left.textContent).not.toContain("Damage Vulnerabilities");
    expect(left.querySelector(".pc-def-empty")).toBeNull();
  });

  it("read-only fallback (editState null): no + button, empty state still rendered", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx());
    expect(root.querySelector(".pc-def-cond-left .pc-def-add-main")).toBeNull();
    expect(root.querySelector(".pc-def-cond-left .pc-def-empty")?.textContent).toBe("no active defenses");
  });

  it("renders a chip per value with × remover", () => {
    const root = mountContainer();
    const editState = { removeDefense: vi.fn() };
    new DefensesConditionsPanel().render(root, ctx({
      defenses: { resistances: ents("fire", "cold"), immunities: ents(), vulnerabilities: ents(), condition_immunities: ents() },
      editState,
    }));
    const chips = root.querySelectorAll(".pc-def-cond-left .pc-def-chip");
    expect(chips.length).toBe(2);
    (chips[0].querySelector<HTMLElement>(".pc-def-chip-x"))!.click();
    expect(editState.removeDefense).toHaveBeenCalledWith("resistances", "fire");
  });

  it("× on a condition immunity chip calls removeConditionImmunity with slug", () => {
    const root = mountContainer();
    const editState = { removeConditionImmunity: vi.fn() };
    new DefensesConditionsPanel().render(root, ctx({
      defenses: { resistances: ents(), immunities: ents(), vulnerabilities: ents(), condition_immunities: ents("charmed") },
      editState,
    }));
    const chip = root.querySelector(".pc-def-cond-left .pc-def-chip")!;
    (chip.querySelector<HTMLElement>(".pc-def-chip-x"))!.click();
    expect(editState.removeConditionImmunity).toHaveBeenCalledWith("charmed");
  });

  it("× hands the mutators the canonical `value`, never the displayed `label`", () => {
    const root = mountContainer();
    const editState = { removeDefense: vi.fn(), removeConditionImmunity: vi.fn() };
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: [ent("psychic", "Psychic")],
        immunities: ents(),
        vulnerabilities: ents(),
        condition_immunities: [ent("charmed", "CHARMED")],
      },
      editState,
    }));
    const chips = [...root.querySelectorAll<HTMLElement>(".pc-def-cond-left .pc-def-chip")];
    expect(chips.length).toBe(2);
    // The chip DISPLAYS the authored spelling (and the PascalCase table for conditions)…
    expect(chips.map((c) => c.querySelector(".pc-def-chip-label")?.textContent)).toEqual([
      "Psychic",
      "Charmed",
    ]);
    // …but both mutators receive the canonical slug, which is what `overrides.defenses.*
    // .remove[]` and the manual list are matched on.
    chips[0].querySelector<HTMLElement>(".pc-def-chip-x")!.click();
    expect(editState.removeDefense).toHaveBeenCalledWith("resistances", "psychic");
    chips[1].querySelector<HTMLElement>(".pc-def-chip-x")!.click();
    expect(editState.removeConditionImmunity).toHaveBeenCalledWith("charmed");
  });
});

describe("DefensesConditionsPanel · granted marking + data-type addressing", () => {
  it("adds .granted to a chip whose origin is 'grant' OR 'equipment', and not to a manual one", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        // Three origins in one bucket · a `=== "grant"` test would drop the equipment chip,
        // so the equipment seed is what pins the predicate to `!== "manual"`.
        resistances: [ent("fire", "Fire", "manual"), ent("psychic", "Psychic", "grant"), ent("cold", "Cold", "equipment")],
        immunities: ents(),
        vulnerabilities: ents(),
        condition_immunities: ents(),
      },
    }));
    const chips = [...root.querySelectorAll<HTMLElement>(".pc-def-cond-left .pc-def-chip")];
    expect(chips.length).toBe(3);
    expect(chips.map((c) => c.classList.contains("granted"))).toEqual([false, true, true]);
  });

  it("chip `data-type` carries the canonical `value`, never the authored or displayed label", () => {
    const root = mountContainer();
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: [ent("psychic", "Psychic")],
        immunities: ents(),
        vulnerabilities: ents(),
        // Condition immunities display a THIRD spelling (the PascalCase table), so this chip
        // separates `value` from `label` and from the rendered text at the same time.
        condition_immunities: [ent("charmed", "CHARMED")],
      },
    }));
    const chips = [...root.querySelectorAll<HTMLElement>(".pc-def-cond-left .pc-def-chip")];
    expect(chips.length).toBe(2);
    expect(chips.map((c) => c.getAttribute("data-type"))).toEqual(["psychic", "charmed"]);
    expect(chips.map((c) => c.querySelector(".pc-def-chip-label")?.textContent)).toEqual(["Psychic", "Charmed"]);
    // The two rejected candidates, per chip: the authored `label` the fixture seeded, and
    // the text actually rendered. Either one substituted for `value` fails the block above.
    const authored = ["Psychic", "CHARMED"];
    chips.forEach((c, i) => {
      expect(c.getAttribute("data-type")).not.toBe(authored[i]);
      expect(c.getAttribute("data-type")).not.toBe(c.querySelector(".pc-def-chip-label")!.textContent);
    });
  });

  it("a [data-type] selector reaches a row's SECOND chip, where a bare .pc-def-chip-x resolves to the first", () => {
    const root = mountContainer();
    const editState = { removeDefense: vi.fn() };
    new DefensesConditionsPanel().render(root, ctx({
      defenses: {
        resistances: [ent("fire", "Fire", "manual"), ent("psychic", "Psychic", "grant")],
        immunities: ents(),
        vulnerabilities: ents(),
        condition_immunities: ents(),
      },
      editState,
    }));
    // What a CDP `--click '… .pc-def-chip-x'` resolves to: the FIRST match, whose chip is Fire.
    // cdp-verify's --click is a `document.querySelector`, so this is the real resolution rule.
    expect(root.querySelector(".pc-def-chip")!.getAttribute("data-type")).toBe("fire");
    const firstX = root.querySelector<HTMLElement>(".pc-def-chip-x")!;
    expect(firstX.closest(".pc-def-chip")!.getAttribute("data-type")).toBe("fire");
    // `data-type` names the second one outright, without leaning on `.granted` (a
    // display-policy class) to do the addressing. A positional `:nth-child` could also
    // reach it · that is order-fragile, not impossible.
    root.querySelector<HTMLElement>('.pc-def-chip[data-type="psychic"] .pc-def-chip-x')!.click();
    expect(editState.removeDefense).toHaveBeenCalledWith("resistances", "psychic");
    expect(editState.removeDefense).toHaveBeenCalledTimes(1);
  });
});

// CSS-source contract (jsdom does no layout; same pattern as pc-ac-tooltip.test.ts and
// pc-portrait-picker-modal.test.ts, which read THIS file). This is the only PRESENCE guard on
// the rule: `check:css` compares styles.css against a fresh build, so it catches a stale
// artifact, not a deleted one · deleting the rule from the partial AND re-running build:css
// leaves `check:css` green (measured rc=0, on this tree). THIS test is what goes red.
describe("defense chip .granted CSS contract", () => {
  const cssPath = resolve(__dirname, "../packages/obsidian/src/modules/pc/styles/components.css");
  const ruleOf = (selector: string): string => {
    const css = readFileSync(cssPath, "utf8");
    const match = css.match(new RegExp(selector.replace(/[.\\[\]()]/g, "\\$&") + "\\s*\\{([^}]+)\\}"));
    expect(match, `${selector} rule missing from components.css`).toBeTruthy();
    return (match as RegExpMatchArray)[1];
  };
  it("the rule exists in components.css and declares a dashed border + soft ink", () => {
    const block = ruleOf(".archivist-pc-sheet .pc-def-chip.granted");
    expect(block).toMatch(/border-style:\s*dashed/);
    expect(block).toMatch(/color:\s*var\(--pc-text-soft/);
  });
});
