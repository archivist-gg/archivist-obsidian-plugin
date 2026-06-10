/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChoiceCallout, applyChoiceToggle } from "../src/modules/pc/components/builder/choice-callout";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

const OPTS = [
  { value: "athletics", label: "Athletics" },
  { value: "stealth", label: "Stealth" },
  { value: "arcana", label: "Arcana" },
];

describe("applyChoiceToggle", () => {
  it("toggles membership under the limit", () => {
    const sel = new Set<string>();
    applyChoiceToggle(sel, "stealth", 2);
    expect([...sel]).toEqual(["stealth"]);
    applyChoiceToggle(sel, "stealth", 2);
    expect(sel.size).toBe(0);
  });

  it("choose-1 swaps instead of refusing", () => {
    const sel = new Set<string>(["athletics"]);
    applyChoiceToggle(sel, "stealth", 1);
    expect([...sel]).toEqual(["stealth"]);
  });

  it("choose-N refuses additions beyond the limit", () => {
    const sel = new Set<string>(["athletics", "stealth"]);
    applyChoiceToggle(sel, "arcana", 2);
    expect(sel.has("arcana")).toBe(false);
    expect(sel.size).toBe(2);
  });

  it("choose-0 refuses all additions but still allows removal", () => {
    const sel = new Set<string>();
    applyChoiceToggle(sel, "athletics", 0);
    expect(sel.size).toBe(0);
    const stale = new Set<string>(["athletics"]);
    applyChoiceToggle(stale, "athletics", 0);
    expect(stale.size).toBe(0);
  });
});

describe("renderChoiceCallout (N1)", () => {
  it("renders label, Choose-N badge, and one chip per option", () => {
    const root = mountContainer();
    renderChoiceCallout(root, { label: "Skills", choose: 2, options: OPTS, selected: new Set(), onToggle: () => {} });
    expect(root.querySelector(".pc-bchoice-label")?.textContent).toBe("Skills");
    expect(root.querySelector(".pc-bchoice-badge")?.textContent).toBe("Choose 2");
    expect(root.querySelectorAll(".pc-bchoice-chip").length).toBe(3);
  });

  it("marks selected chips crimson with a ✓ and fires onToggle on click", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    renderChoiceCallout(root, { label: "Skills", choose: 2, options: OPTS, selected: new Set(["stealth"]), onToggle });
    const chips = root.querySelectorAll<HTMLElement>(".pc-bchoice-chip");
    expect(chips[1].classList.contains("sel")).toBe(true);
    expect(chips[1].textContent).toContain("✓");
    chips[0].click();
    expect(onToggle).toHaveBeenCalledWith("athletics");
  });

  it("at the choose-N limit, unselected chips are muted and ignore clicks", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    renderChoiceCallout(root, { label: "Skills", choose: 2, options: OPTS, selected: new Set(["athletics", "stealth"]), onToggle });
    const arcana = root.querySelectorAll<HTMLElement>(".pc-bchoice-chip")[2];
    expect(arcana.classList.contains("muted")).toBe(true);
    arcana.click();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("choose-1 never mutes (a different pick is a swap request)", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    renderChoiceCallout(root, { label: "Subrace", choose: 1, options: OPTS, selected: new Set(["athletics"]), onToggle });
    const stealth = root.querySelectorAll<HTMLElement>(".pc-bchoice-chip")[1];
    expect(stealth.classList.contains("muted")).toBe(false);
    stealth.click();
    expect(onToggle).toHaveBeenCalledWith("stealth");
  });

  it("shows the amber ! only when required and empty", () => {
    const root = mountContainer();
    renderChoiceCallout(root, { label: "Skills", choose: 2, options: OPTS, selected: new Set(), onToggle: () => {}, required: true });
    expect(root.querySelector(".pc-bchoice-flag")).not.toBeNull();
    const root2 = mountContainer();
    renderChoiceCallout(root2, { label: "Skills", choose: 2, options: OPTS, selected: new Set(["stealth"]), onToggle: () => {}, required: true });
    expect(root2.querySelector(".pc-bchoice-flag")).toBeNull();
  });
});
