/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderRaceBlock } from "../packages/obsidian/src/modules/race/race.renderer";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";

beforeAll(() => installObsidianDomHelpers());

const race: RaceEntity = {
  slug: "srd-5e_dwarf",
  name: "Dwarf",
  edition: "2014",
  source: "SRD 5.1",
  description: "Bold and **hardy**, dwarves are known as skilled warriors.",
  size: "medium",
  speed: { walk: 30 },
  ability_score_increases: [],
  age: "Dwarves mature at the same rate as humans.",
  alignment: "Most dwarves are lawful.",
  vision: { darkvision: 60 },
  languages: { fixed: [] },
  variant_label: "",
  traits: [
    {
      name: "Dwarven Resilience",
      description: "You have **advantage** on saving throws against poison.",
    },
    {
      name: "Stonecunning",
      entries: ["You are considered proficient in History checks", "related to stonework."],
    },
  ],
} as unknown as RaceEntity;

describe("renderRaceBlock", () => {
  it("renders the shared parchment block with name, size header, and source badge", async () => {
    const root = mountContainer();
    root.appendChild(await renderRaceBlock(race));
    expect(root.querySelector(".archivist-spell-block.archivist-race-block")).not.toBeNull();
    expect(
      root.querySelector(".archivist-spell-block-wrapper.archivist-race-block-wrapper"),
    ).not.toBeNull();
    expect(root.querySelector(".spell-name")?.textContent).toBe("Dwarf");
    expect(root.querySelector(".spell-school")?.textContent).toBe("Medium Race");
    expect(root.querySelector(".source-badge")?.textContent).toBe("SRD 5e");
  });

  it("renders speed and darkvision properties", async () => {
    const root = mountContainer();
    root.appendChild(await renderRaceBlock(race));
    expect(root.textContent).toContain("Speed:");
    expect(root.textContent).toContain("30 ft.");
    expect(root.textContent).toContain("Darkvision:");
    expect(root.textContent).toContain("60 ft.");
  });

  it("omits the darkvision row when vision.darkvision is undefined", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderRaceBlock({ ...race, vision: {} } as unknown as RaceEntity),
    );
    expect(root.textContent).toContain("Speed:");
    expect(root.textContent).not.toContain("Darkvision:");
  });

  it("renders the description through the markdown pipeline", async () => {
    const root = mountContainer();
    root.appendChild(await renderRaceBlock(race));
    const desc = root.querySelector(".spell-description");
    expect(desc).not.toBeNull();
    // The Obsidian MarkdownRenderer is stubbed in tests (raw text passthrough),
    // so we assert the prose flows into the dedicated description container.
    expect(desc?.textContent).toContain("skilled warriors");
  });

  it("renders each trait with its name in a bold serif marker and its text", async () => {
    const root = mountContainer();
    root.appendChild(await renderRaceBlock(race));
    const traits = root.querySelectorAll(".race-traits .race-trait");
    expect(traits.length).toBe(2);
    expect(traits[0].querySelector(".race-trait-name")?.textContent).toBe("Dwarven Resilience");
    expect(traits[0].textContent).toContain("saving throws against poison");
    // entries[] is joined with a space when description is absent
    expect(traits[1].querySelector(".race-trait-name")?.textContent).toBe("Stonecunning");
    expect(traits[1].textContent).toContain("proficient in History checks");
    expect(traits[1].textContent).toContain("related to stonework.");
  });

  it("renders no source badge when edition and source are absent", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderRaceBlock({ ...race, edition: undefined, source: undefined } as unknown as RaceEntity),
    );
    expect(root.querySelector(".source-badge")).toBeNull();
  });

  it("surfaces fixed languages and ability bonuses when the data carries them", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderRaceBlock({
        ...race,
        ability_score_increases: [{ ability: "constitution", amount: 2 }],
        languages: { fixed: ["Common", "Dwarvish"] },
      } as unknown as RaceEntity),
    );
    expect(root.textContent).toContain("Ability Scores:");
    expect(root.textContent).toContain("Constitution +2");
    expect(root.textContent).toContain("Languages:");
    expect(root.textContent).toContain("Common, Dwarvish");
  });
});
