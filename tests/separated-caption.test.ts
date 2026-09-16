/** @vitest-environment jsdom */
/**
 * R4-G6b §10.1 · the separated-caption primitive (spec §14 row 25).
 *
 * The shape under test: each part is a UNIT (`span.pc-cap-unit`) holding an out-of-flow separator
 * (`span.pc-cap-sep`, `aria-hidden`) and the BARE segment (`span.pc-cap-seg`). The composed
 * `textContent` is byte-identical to the joined strings the five carriers printed before
 * (invariant 9), which is what keeps every carrier pin in §14 row 26 green without a re-point.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { renderSeparated } from "../packages/obsidian/src/modules/pc/components/separated-caption";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderSeparated (R4-G6b §10.1)", () => {
  it("the separator is the UNIT's child, never the segment's: segments stay bare", () => {   // m15's kill row
    const host = mountContainer().createDiv();
    renderSeparated(host, ["Passive", "2 Sorcery Point"], { sep: "·", segCls: "pc-spell-sub-seg" });
    expect(Array.from(host.querySelectorAll(".pc-spell-sub-seg")).map((e) => e.textContent)).toEqual(["Passive", "2 Sorcery Point"]);
    expect(host.querySelector(".pc-cap-seg .pc-cap-sep")).toBeNull();
  });
  it("list mode: units after the first carry a separator child; the host composes byte-stably", () => {
    const host = mountContainer().createDiv();
    const units = renderSeparated(host, ["Passive", "2 Sorcery Point"], { sep: "·", segCls: "pc-spell-sub-seg" });
    expect(units.length).toBe(2);
    expect(host.classList.contains("pc-cap-host")).toBe(true);
    expect(host.classList.contains("pc-cap-spaced")).toBe(true);
    expect(units[0].querySelector(".pc-cap-sep")).toBeNull();
    expect(units[1].querySelector(".pc-cap-sep")?.textContent).toBe("· ");
    expect(units[1].querySelector(".pc-cap-sep")?.getAttribute("aria-hidden")).toBe("true");
    expect(host.textContent).toBe("Passive · 2 Sorcery Point");
  });
  it("leading mode with spaces: a single part after an existing child composes `Active · 1 minute`", () => {  // m16's kill row
    const host = mountContainer().createDiv(); host.createEl("label", { text: "Active" });
    const [u] = renderSeparated(host, ["1 minute"], { sep: "·", leading: true, segCls: "pc-action-buff-duration" });
    expect(host.textContent).toBe("Active · 1 minute");
    expect(u.querySelector(".pc-cap-sep")?.textContent).toBe("· ");
    expect(u.querySelector(".pc-action-buff-duration")?.textContent).toBe("1 minute");
  });
  it("leading mode without spaces: no text node, no pc-cap-spaced, the unit reads `/ Long Rest`", () => {  // m17's kill row
    const host = mountContainer().createDiv(); host.createDiv({ cls: "pips" });
    const [u] = renderSeparated(host, ["Long Rest"], { sep: "/", leading: true, spaces: false, unitCls: "pc-charge-recovery" });
    expect(Array.from(host.childNodes).some((n) => n.nodeType === 3)).toBe(false);
    expect(u.classList.contains("pc-charge-recovery")).toBe(true);
    expect(u.textContent).toBe("/ Long Rest");
    expect(host.textContent).toBe("/ Long Rest");
    // §14 row 25 pins BOTH halves of the `spaces: false` case: the spacing class stays off AND the
    // clipping class goes on. Only the host class makes the ruling work on the two flex carriers, and
    // nothing else in `tests/` asserts it outside the spaces-TRUE `it` (T8 review, m15b).
    expect(host.classList.contains("pc-cap-host")).toBe(true);
    expect(host.classList.contains("pc-cap-spaced")).toBe(false);
  });
});
