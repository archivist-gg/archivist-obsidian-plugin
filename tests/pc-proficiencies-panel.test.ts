/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

vi.mock("@archivist-gg/dnd5e/pc/pc.proficiencies", () => ({
  aggregateProficiencies: () => ({
    armor: ["Light"],
    weapons: ["Hand Crossbows", "Rapiers"],
    tools: [],
    languages: ["Common"],
    choices: { languages: ["choose 2"], tools: [] },
  }),
}));

import { ProficienciesPanel } from "../packages/obsidian/src/modules/pc/components/proficiencies-panel";

beforeAll(() => installObsidianDomHelpers());

const ctx: ComponentRenderContext = {
  resolved: {} as ResolvedCharacter,
  derived: {} as never,
  services: {} as never,
  editState: null,
};

function valueFor(container: HTMLElement, label: string): string {
  const lines = [...container.querySelectorAll(".pc-prof-line")];
  const line = lines.find((l) => l.querySelector(".pc-prof-key")?.textContent === `${label}: `);
  return line?.querySelector(".pc-prof-vals")?.textContent ?? "";
}

describe("ProficienciesPanel", () => {
  it("renders items comma-joined, choice placeholders after ' · ', and 'None' for empty buckets", () => {
    const container = mountContainer();
    new ProficienciesPanel().render(container, ctx);

    expect(valueFor(container, "Weapons")).toBe("Hand Crossbows, Rapiers");
    expect(valueFor(container, "Languages")).toBe("Common · choose 2");
    expect(valueFor(container, "Tools")).toBe("None");
    expect(valueFor(container, "Armor")).toBe("Light");
  });

  it("renders no em-dash (U+2014) anywhere in the panel subtree", () => {
    const container = mountContainer();
    new ProficienciesPanel().render(container, ctx);
    expect(container.textContent).not.toContain("\u2014");
  });
});
