/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { renderChronicleBlock, renderSectionRule } from "../src/modules/pc/components/builder/chronicle-block";

beforeAll(() => installObsidianDomHelpers());

describe("renderChronicleBlock", () => {
  it("renders band, badge, tiles, and body in order; flavor only when given", () => {
    const c = mountContainer();
    renderChronicleBlock(c, {
      name: "Elf",
      sub: "Species · Medium · 30 ft. · Darkvision 60 ft.",
      badge: "SRD 5.2 · 2024",
      tiles: [
        { label: "Size", value: "Medium" },
        { label: "Speed", value: "30", small: "ft." },
      ],
      body: (host) => host.createDiv({ cls: "x-body" }),
    });
    const block = c.querySelector(".pc-cblock")!;
    expect(block.querySelector(".pc-cb-badge")!.textContent).toBe("SRD 5.2 · 2024");
    expect(block.querySelector(".pc-cb-name")!.textContent).toBe("Elf");
    expect(block.querySelector(".pc-cb-flavor")).toBeNull();
    expect(block.querySelectorAll(".pc-cb-tile").length).toBe(2);
    expect(block.querySelector(".x-body")).not.toBeNull();
  });

  it("pre() content lands ABOVE the identity band; flavor between band and tiles", () => {
    const c = mountContainer();
    renderChronicleBlock(c, {
      name: "Acolyte", sub: "Background", flavor: "A life of service.",
      tiles: [], body: () => {},
      pre: (host) => host.createDiv({ cls: "x-warn" }),
    });
    const kids = [...c.querySelector(".pc-cblock")!.children].map((k) => k.className.split(" ")[0]);
    expect(kids.indexOf("x-warn")).toBeLessThan(kids.indexOf("pc-cb-bh"));
    expect(kids.indexOf("pc-cb-bh")).toBeLessThan(kids.indexOf("pc-cb-flavor"));
  });

  it("renderSectionRule renders label + right note", () => {
    const c = mountContainer();
    renderSectionRule(c, "What you decide", "3 total · 1 resolved");
    expect(c.querySelector(".pc-cb-sec-l")!.textContent).toBe("What you decide");
    expect(c.querySelector(".pc-cb-sec-r")!.textContent).toBe("3 total · 1 resolved");
  });
});
