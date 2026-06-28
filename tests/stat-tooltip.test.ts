/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { attachStatTooltip } from "../src/modules/pc/components/stat-tooltip";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("attachStatTooltip", () => {
  it("shows the host on mouseenter and removes it on mouseleave", () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    attachStatTooltip(anchor, (host) => host.createSpan({ text: "hi" }));
    anchor.dispatchEvent(new Event("mouseenter"));
    expect(anchor.querySelector(".pc-stat-tooltip")?.textContent).toBe("hi");
    anchor.dispatchEvent(new Event("mouseleave"));
    expect(anchor.querySelector(".pc-stat-tooltip")).toBeNull();
  });

  it("does not create a second host when mouseenter fires twice", () => {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    attachStatTooltip(anchor, (host) => host.createSpan({ text: "hi" }));
    anchor.dispatchEvent(new Event("mouseenter"));
    anchor.dispatchEvent(new Event("mouseenter"));
    expect(anchor.querySelectorAll(".pc-stat-tooltip").length).toBe(1);
  });
});
