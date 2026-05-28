/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderFeatureExpand } from "../src/modules/pc/components/actions/feature-expand";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { Feature } from "../src/shared/types/feature";

beforeAll(() => installObsidianDomHelpers());

describe("renderFeatureExpand", () => {
  it("renders feature.name as title and feature.description as body", () => {
    const root = mountContainer();
    const f: Feature = { name: "Action Surge", description: "Take one extra action this turn." };
    renderFeatureExpand(root, f, "Fighter 2");
    expect(root.querySelector(".pc-feature-expand-title")?.textContent).toBe("Action Surge");
    expect(root.querySelector(".pc-feature-expand-meta")?.textContent).toBe("Fighter 2");
    expect(root.querySelector(".pc-feature-expand-body")?.textContent).toContain("extra action");
  });

  it("renders entries as paragraphs when description absent", () => {
    const root = mountContainer();
    const f: Feature = { name: "X", entries: ["First paragraph.", "Second paragraph."] };
    renderFeatureExpand(root, f, "");
    const ps = root.querySelectorAll(".pc-feature-expand-body p");
    expect(ps.length).toBe(2);
    expect(ps[0].textContent).toBe("First paragraph.");
  });

  it("renders structured attacks under .pc-feature-expand-attacks", () => {
    const root = mountContainer();
    const f: Feature = {
      name: "Eldritch Blast",
      description: "Beams of force.",
      attacks: [{ name: "Beam", type: "spell", damage: "1d10", damage_type: "force", range: { normal: 120 } }] as never,
    };
    renderFeatureExpand(root, f, "Warlock 1");
    expect(root.querySelector(".pc-feature-expand-attacks")).toBeTruthy();
  });
});
