/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderRaceBlock } from "../packages/obsidian/src/modules/pc/components/passive/race-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

// A Kalashtar-shaped race: `vision:{}` (no darkvision), a Size + Speed
// pseudo-trait pair (folded out), a plain trait, and a CHOICE-bearing trait
// (which the sheet — unlike the builder — must still render since it has no
// decision strip).
const race = (over: Partial<RaceEntity> = {}): RaceEntity =>
  ({
    slug: "kalashtar", name: "Kalashtar", edition: "2014", source: "", description: "",
    size: "medium", speed: { walk: 30 }, ability_score_increases: [], age: "", alignment: "",
    vision: {}, languages: { fixed: [] }, variant_label: "",
    traits: [
      { name: "Size", description: "Your size is Medium." },
      { name: "Speed", description: "Your walking speed is 30 feet." },
      { name: "Dual Mind", description: "You have advantage on Wisdom saving throws." },
      { name: "Elven Lineage", description: "Choose a lineage.", choices: [{ id: "lineage" } as never] },
    ],
    ...over,
  }) as unknown as RaceEntity;

const ctxWith = (r: RaceEntity | null): ComponentRenderContext =>
  ({ resolved: { race: r } as unknown as ResolvedCharacter } as unknown as ComponentRenderContext);

const tileLabels = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-cb-tile .pc-cb-tl")].map((n) => n.textContent ?? "");
const traitNames = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-cb-trait-n")].map((n) => n.textContent ?? "");

describe("renderRaceBlock", () => {
  it("renders exactly ONE Race block titled 'Race · <species>'", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const blocks = c.querySelectorAll(".pc-race-block");
    expect(blocks.length).toBe(1);
    expect(c.querySelector(".pc-race-block .pc-cb-name")?.textContent).toBe("Race · Kalashtar");
  });

  it("renders a Size tile and a Speed tile, and NO Darkvision tile when vision:{} (F5)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const labels = tileLabels(c);
    expect(labels).toContain("Size");
    expect(labels).toContain("Speed");
    expect(labels).not.toContain("Darkvision");
  });

  it("renders a Darkvision tile ONLY when the race grants darkvision", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race({ vision: { darkvision: 60 } })));
    expect(tileLabels(c)).toContain("Darkvision");
    expect(c.querySelector(".pc-cb-tile .pc-cb-ts")?.textContent).toBeTruthy(); // "ft."
  });

  it("null-guards a missing walking speed (speed:{} → em dash, no crash)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race({ speed: {} })));
    expect(tileLabels(c)).toContain("Speed");
    // The Speed tile value falls back to a dash rather than "undefined".
    const speedTile = [...c.querySelectorAll<HTMLElement>(".pc-cb-tile")].find(
      (t) => t.querySelector(".pc-cb-tl")?.textContent === "Speed",
    )!;
    expect(speedTile.querySelector(".pc-cb-tv")?.textContent).not.toContain("undefined");
  });

  it("renders BOTH a plain trait AND a choice-bearing trait as rows (choice-bearing NOT hidden — F4)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const names = traitNames(c);
    expect(names).toContain("Dual Mind");
    expect(names).toContain("Elven Lineage"); // choices present, but sheet has no strip → must render
  });

  it("folds out the size/speed pseudo-traits (no Size/Speed trait rows)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const names = traitNames(c);
    expect(names).not.toContain("Size");
    expect(names).not.toContain("Speed");
  });

  it("renders a literal 'Creature Type' trait as a normal row (NOT in the fold set)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race({
      traits: [
        { name: "Size", description: "Medium." },
        { name: "Creature Type", description: "You are a Humanoid." },
      ] as never,
    })));
    expect(traitNames(c)).toContain("Creature Type");
  });

  it("is default-expanded and toggles the body's `hidden` on header click", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const header = c.querySelector<HTMLElement>(".pc-race-block-head")!;
    const body = c.querySelector<HTMLElement & { hidden: boolean }>(".pc-race-block-body")!;
    expect(body.hidden).toBe(false); // default expanded
    header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.hidden).toBe(true);
    header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.hidden).toBe(false);
  });

  it("renders nothing when race is null", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(null));
    expect(c.querySelector(".pc-race-block")).toBeNull();
    expect(c.childElementCount).toBe(0);
  });
});
