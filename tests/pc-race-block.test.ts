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

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const tileLabels = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-cb-tile .pc-cb-tl")].map((n) => n.textContent ?? "");
const traitNames = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-cb-trait-n")].map((n) => n.textContent ?? "");

describe("renderRaceBlock (section -> row -> expand idiom)", () => {
  it("renders a 'Race' section heading + one feature row named for the species, NOT the bespoke .pc-race-block card", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    // The bespoke standalone `.pc-race-block` card is retired. The full chronicle
    // block now renders INSIDE the row-expand, so its `.pc-cb-name` title lives
    // there (not as a top-level bespoke card, and not combined into a "Race · …"
    // header — the "Race" section heading and the row are unchanged).
    expect(c.querySelector(".pc-race-block")).toBeNull();
    const cbName = c.querySelector<HTMLElement>(".pc-cb-name");
    expect(cbName?.textContent).toBe("Kalashtar");
    expect(cbName?.closest(".pc-action-expand")).toBeTruthy();
    // A section heading in the shared idiom.
    expect(headings(c)).toContain("Race");
    // Exactly one flat feature row, named for the species, with an expand caret.
    const rows = c.querySelectorAll(".pc-action-row.pc-feature-row");
    expect(rows.length).toBe(1);
    const row = rows[0] as HTMLElement;
    expect(row.querySelector(".pc-action-row-name")?.textContent).toBe("Kalashtar");
    expect(row.querySelector(".pc-action-caret")).toBeTruthy();
  });

  it("houses the glance tiles + trait rows inside the row-expand card (not a standalone bordered card)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const expand = c.querySelector<HTMLElement>(".pc-action-expand")!;
    expect(expand).toBeTruthy();
    expect(expand.querySelector(".pc-cb-glance")).toBeTruthy();
    expect(expand.querySelector(".pc-cb-trait")).toBeTruthy();
    // Nothing leaks outside the expand: every tile + trait is a descendant of it.
    expect(c.querySelector(".pc-cb-tile")!.closest(".pc-action-expand")).toBe(expand);
    expect(c.querySelector(".pc-cb-trait")!.closest(".pc-action-expand")).toBe(expand);
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

  it("drops the Speed tile when walking speed is missing (speed:{} → no tile, no 'undefined')", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race({ speed: {} })));
    // Each glance tile is conditional now (mirrors the builder's Race step): with
    // no `walk`, the Speed tile is omitted entirely rather than showing a fallback,
    // and the sub-line drops the empty speed segment.
    expect(tileLabels(c)).not.toContain("Speed");
    // Nothing (tiles or sub-line) leaks the literal string "undefined".
    expect(c.textContent).not.toContain("undefined");
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

  it("is COLLAPSED by default and toggles the expand's `hidden` on row click (feature-row idiom)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(race()));
    const row = c.querySelector<HTMLElement>(".pc-action-row")!;
    const expand = c.querySelector<HTMLElement & { hidden: boolean }>(".pc-action-expand")!;
    expect(expand.hidden).toBe(true); // collapsed by default, like sibling feature rows
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(expand.hidden).toBe(false);
    expect(row.classList.contains("pc-row-open")).toBe(true);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(expand.hidden).toBe(true);
    expect(row.classList.contains("pc-row-open")).toBe(false);
  });

  it("renders nothing when race is null", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(null));
    expect(c.querySelector(".pc-race-block")).toBeNull();
    expect(c.querySelector(".pc-action-row")).toBeNull();
    expect(c.childElementCount).toBe(0);
  });
});
