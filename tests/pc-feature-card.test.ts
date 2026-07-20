/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { type App } from "obsidian";
import {
  renderFeatureCard,
  featureCardDescription,
  resolveFeatureDescription,
  formatSourceLabel,
  RESET_LABEL,
} from "../packages/obsidian/src/modules/pc/blocks/feature-card";
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

  it("(b) a card with NO Resource renders NO Recharge/Die property-line and NO recovery action", () => {
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
