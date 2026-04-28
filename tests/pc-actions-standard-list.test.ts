/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderStandardActionsList } from "../src/modules/pc/components/actions/standard-actions-list";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

describe("StandardActionsList", () => {
  it("renders title + comma-separated 16 standard actions", () => {
    const root = mountContainer();
    renderStandardActionsList(root);
    const block = root.querySelector(".pc-standard-actions");
    expect(block).toBeTruthy();
    expect(block?.querySelector(".pc-standard-actions-title")?.textContent?.toLowerCase())
      .toContain("standard combat actions");
    const body = block?.querySelector(".pc-standard-actions-body")?.textContent ?? "";
    ["Attack", "Cast a Spell", "Dash", "Disengage", "Dodge", "Grapple", "Help", "Hide",
     "Improvise", "Influence", "Magic", "Ready", "Search", "Shove", "Study", "Utilize"]
      .forEach((a) => expect(body).toContain(a));
  });
});
