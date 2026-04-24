/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import {
  CONDITION_ICONS,
  EXHAUSTION_ICON,
  setConditionIcon,
  setExhaustionIcon,
} from "../src/modules/pc/assets/condition-icons";
import { CONDITION_SLUGS } from "../src/modules/pc/constants/conditions";

describe("condition-icons", () => {
  it("exports one SVG string per condition slug", () => {
    for (const slug of CONDITION_SLUGS) {
      expect(CONDITION_ICONS[slug]).toBeTruthy();
      expect(CONDITION_ICONS[slug]).toContain("<svg");
    }
  });

  it("exports an EXHAUSTION_ICON SVG", () => {
    expect(EXHAUSTION_ICON).toContain("<svg");
  });

  it("setConditionIcon mounts an <svg> child into the host element", () => {
    const host = document.createElement("div");
    setConditionIcon(host, "blinded");
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.classList.contains("pc-cond-icon")).toBe(true);
    expect(host.getAttribute("aria-hidden")).toBe("true");
  });

  it("setExhaustionIcon mounts an <svg> child into the host element", () => {
    const host = document.createElement("div");
    setExhaustionIcon(host);
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.classList.contains("pc-cond-icon")).toBe(true);
  });
});
