/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import {
  renderFeatureCard,
  renderExpandBlock,
  featureCardDescription,
  resolveFeatureDescription,
  formatSourceLabel,
  RESET_LABEL,
} from "../packages/obsidian/src/modules/pc/blocks/feature-card";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";

beforeAll(() => installObsidianDomHelpers());

/** Minimal ctx for the resource-keyed adapter path (totalLevel for die scaling,
 *  feature_uses for recovery lookup, no definition → no edition badge). */
function ctx(
  overrides: {
    totalLevel?: number;
    featureUses?: Record<string, { used: number; max: number }>;
    edition?: string;
    spellSlots?: Record<number, { used: number; total: number }>;
  } = {},
): ComponentRenderContext {
  return {
    resolved: {
      totalLevel: overrides.totalLevel ?? 5,
      definition: overrides.edition ? { edition: overrides.edition } : undefined,
      state: { feature_uses: overrides.featureUses ?? {}, spell_slots: overrides.spellSlots },
    } as never,
    derived: {} as never,
    services: {} as never,
    editState: null,
  };
}

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
      feature: { name: "Invoke Hell", entries: ["You call upon infernal power.", "The area erupts in flame."] },
    });
    const desc = root.querySelector(".archivist-item-description");
    expect(desc).toBeTruthy();
    expect(desc?.textContent?.trim().length).toBeGreaterThan(0);
    expect(desc?.textContent).toContain("infernal power");
    // joined paragraphs → one .description-paragraph per entry
    expect(root.querySelectorAll(".archivist-item-description .description-paragraph").length).toBe(2);
  });

  it("(b) a card with NO Resource renders NO Recharge/Die property-line and NO recovery action", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Stonecunning",
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

  it("(c) chosenInline renders \"Chose — <label>: <description>\"", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Combat Mastery",
      feature: { name: "Combat Mastery", description: "Pick a mastery." },
      chosenInline: [{ label: "Lies", description: "use Charisma for melee attack & damage" }],
    });
    const desc = root.querySelector(".archivist-item-description");
    expect(desc?.textContent).toContain("Chose — Lies: use Charisma for melee attack & damage");
    // the base description also survives
    expect(desc?.textContent).toContain("Pick a mastery.");
  });

  it("(c') a chosenInline entry with no description renders \"Chose — <label>\" (no trailing colon, no \"undefined\")", () => {
    const root = mountContainer();
    renderFeatureCard(root, {
      title: "Combat Mastery",
      chosenInline: [{ label: "Bravado" }],
    });
    const text = root.querySelector(".archivist-item-description")?.textContent ?? "";
    expect(text).toContain("Chose — Bravado");
    expect(text).not.toContain("Chose — Bravado:");
    expect(text).not.toContain("undefined");
  });

  it("renders a card with only chosenInline (no description) — still gets a description container", () => {
    const root = mountContainer();
    renderFeatureCard(root, { title: "Pick", chosenInline: [{ label: "A" }] });
    expect(root.querySelector(".archivist-item-description")).toBeTruthy();
  });
});

describe("renderExpandBlock — resource-keyed adapter (regression-safe)", () => {
  it("(d) a resource-keyed card still shows the Recharge line + die", () => {
    const root = mountContainer();
    renderExpandBlock(
      root,
      { id: "bard:bi", name: "Bardic Inspiration", max_formula: "4", reset: "short-rest", die: { base: "d8" } },
      { name: "Bardic Inspiration", description: "You can inspire others." },
      { kind: "class", slug: "bard", level: 1 },
      ctx(),
    );
    // properties container + both icon property-lines present
    const props = root.querySelector(".archivist-item-properties");
    expect(props).toBeTruthy();
    const values = [...root.querySelectorAll(".archivist-property-value")].map((v) => v.textContent);
    expect(values).toContain("Short Rest"); // RESET_LABEL["short-rest"]
    expect(values).toContain("d8"); // resolveScalingDie({base:"d8"})
    // title from resource.name, italic source subtitle from formatSourceLabel
    expect(root.querySelector(".archivist-item-name")?.textContent).toBe("Bardic Inspiration");
    expect(root.querySelector(".archivist-item-subtitle")?.textContent).toBe("Bard 1");
    expect(root.querySelector(".archivist-item-description")?.textContent).toContain("inspire others");
  });

  it("a resource feature whose prose is in entries (no description) still renders non-empty (fallback in the real path)", () => {
    const root = mountContainer();
    renderExpandBlock(
      root,
      { id: "r:x", name: "Runic Power", max_formula: "3", reset: "long-rest" },
      { name: "Runic Power", entries: ["Runes flare with power."] },
      { kind: "class", slug: "runeknight", level: 3 },
      ctx(),
    );
    expect(root.querySelector(".archivist-item-description")?.textContent).toContain("Runes flare");
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

  it("RESET_LABEL maps reset triggers to friendly labels", () => {
    expect(RESET_LABEL["short-rest"]).toBe("Short Rest");
    expect(RESET_LABEL["long-rest"]).toBe("Long Rest");
  });

  it("resolveFeatureDescription returns the base and appends chosen picks", () => {
    expect(resolveFeatureDescription({ name: "X", description: "base" }, undefined)).toBe("base");
    const r = resolveFeatureDescription({ name: "X", description: "base" }, { skills: ["athletics"] });
    expect(r).toContain("Skills: Athletics");
  });
});
