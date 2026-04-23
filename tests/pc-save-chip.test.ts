/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderSaveChip } from "../src/modules/pc/components/save-chip";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("renderSaveChip", () => {
  it("renders a non-proficient chip with SAVE label and bonus", () => {
    const root = mountContainer();
    renderSaveChip(root, { bonus: -3, proficient: false });
    const chip = root.querySelector(".pc-save-chip");
    expect(chip).not.toBeNull();
    expect(chip?.classList.contains("prof")).toBe(false);
    expect(chip?.querySelector(".archivist-prof-toggle")).not.toBeNull();
    expect(chip?.querySelector(".archivist-prof-toggle")?.classList.contains("proficient")).toBe(false);
    expect(chip?.textContent).toContain("SAVE");
    expect(chip?.textContent).toContain("−3");  // U+2212
  });

  it("renders a proficient chip with .prof class and filled toggle", () => {
    const root = mountContainer();
    renderSaveChip(root, { bonus: 6, proficient: true });
    const chip = root.querySelector(".pc-save-chip");
    expect(chip?.classList.contains("prof")).toBe(true);
    expect(chip?.querySelector(".archivist-prof-toggle.proficient")).not.toBeNull();
    expect(chip?.textContent).toContain("+6");
  });

  it("uses the Unicode minus sign (U+2212) for negative bonuses", () => {
    const root = mountContainer();
    renderSaveChip(root, { bonus: -1, proficient: false });
    expect(root.querySelector(".pc-save-chip")?.textContent).toContain("−1");
  });
});
