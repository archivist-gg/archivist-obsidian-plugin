/** @vitest-environment jsdom */
// The decision-ledger/choice-callout renderers were retired in Task 14 (commit
// ca270c0), but `renderChoiceCallout` survives because custom-background.ts still
// consumes it directly (a Task-14 deviation). The strip now owns applyChoiceToggle
// (covered by pc-builder-decision-strip.test.ts), so these slim tests exist solely
// to guard the surviving renderer's edge paths — the `.inert` missing-option path
// and the required-but-empty amber `!` flag — which the custom-background form
// tests only exercise on the happy path.
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderChoiceCallout } from "../packages/obsidian/src/modules/pc/components/builder/choice-callout";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

const OPTS = [
  { value: "athletics", label: "Athletics" },
  { value: "stealth", label: "Stealth" },
  { value: "arcana", label: "Arcana" },
];

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

  it("renders an inert option with the .inert class and ignores clicks", () => {
    const root = mountContainer();
    const onToggle = vi.fn();
    const options = [
      { value: "athletics", label: "Athletics" },
      { value: "ghost-walk", label: "Ghost Walk (missing)", inert: true },
    ];
    renderChoiceCallout(root, { label: "Skills", choose: 1, options, selected: new Set(), onToggle });
    const chips = root.querySelectorAll<HTMLElement>(".pc-bchoice-chip");
    expect(chips[1].classList.contains("inert")).toBe(true);
    chips[1].click();
    expect(onToggle).not.toHaveBeenCalled();
    // a normal chip in the same callout still fires
    chips[0].click();
    expect(onToggle).toHaveBeenCalledWith("athletics");
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
