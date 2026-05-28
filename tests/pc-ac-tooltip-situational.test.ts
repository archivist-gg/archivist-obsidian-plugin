/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { renderACTooltip } from "../src/modules/pc/components/ac-tooltip";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";
import type { InformationalBonus } from "../src/modules/item/item.conditions.types";

beforeAll(() => installObsidianDomHelpers());

function setup(): HTMLElement {
  return document.createElement("div");
}

describe("AC tooltip situational section", () => {
  let parent: HTMLElement;
  beforeEach(() => { parent = setup(); });

  it("renders no situational section when informational is empty", () => {
    renderACTooltip(parent, {
      ac: 17,
      breakdown: [{ source: "Chain Mail", amount: 16, kind: "armor" }],
      overridden: false,
      informational: [],
    });
    expect(parent.querySelector(".pc-ac-tooltip-row--situational")).toBeNull();
  });

  it("renders a situational row when informational has entries", () => {
    const informational: InformationalBonus[] = [
      {
        field: "ac",
        source: "Arrow-Catching Shield",
        value: 2,
        conditions: [{ kind: "vs_attack_type", value: "ranged" }],
      },
    ];
    renderACTooltip(parent, {
      ac: 17,
      breakdown: [{ source: "Chain Mail", amount: 16, kind: "armor" }],
      overridden: false,
      informational,
    });
    const sit = parent.querySelector(".pc-ac-tooltip-row--situational");
    expect(sit).not.toBeNull();
    expect(sit!.textContent).toContain("Arrow-Catching Shield");
    expect(sit!.textContent).toContain("vs ranged attacks");
    expect(sit!.textContent).toContain("+2");
  });

  it("renders multiple situational rows in order", () => {
    const informational: InformationalBonus[] = [
      { field: "ac", source: "A", value: 1, conditions: [{ kind: "underwater" }] },
      { field: "ac", source: "B", value: 2, conditions: [{ kind: "bloodied" }] },
    ];
    renderACTooltip(parent, {
      ac: 10,
      breakdown: [],
      overridden: false,
      informational,
    });
    const rows = parent.querySelectorAll(".pc-ac-tooltip-row--situational");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("A");
    expect(rows[1].textContent).toContain("B");
  });
});
