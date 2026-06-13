/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderBackgroundBlock } from "../src/modules/background/background.renderer";
import { backgroundModule } from "../src/modules/background/background.module";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { BackgroundEntity } from "../src/modules/background/background.types";

beforeAll(() => installObsidianDomHelpers());

/** Flush queued microtasks/macrotasks so the async block renderer's
 *  `.then`/`.catch` has run before assertions (mirrors the entity-block
 *  integration test's helper). */
const flush = () => new Promise((r) => setTimeout(r, 0));

const acolyte: BackgroundEntity = {
  slug: "srd-5e_acolyte",
  name: "Acolyte",
  edition: "2014",
  source: "SRD 5.1",
  description: "You have spent your life in the service of a **temple**.",
  skill_proficiencies: ["insight", "religion"],
  // Real SRD data stores tool/equipment tokens as hyphenated slugs, and some
  // carry an embedded apostrophe (e.g. "calligrapher's-supplies" in Sage.md).
  tool_proficiencies: [{ kind: "fixed", items: ["calligrapher's-supplies"] }],
  language_proficiencies: [{ kind: "choice", count: 2, from: "any" }],
  equipment: [
    { kind: "fixed", grants: [{ item: "holy-symbol", qty: 1 }] },
    { kind: "gold", amount: 15 },
  ],
  feature: {
    name: "Shelter of the Faithful",
    description: "You command the respect of those who share your faith.",
  },
  ability_score_increases: null,
  origin_feat: null,
  suggested_characteristics: null,
} as unknown as BackgroundEntity;

describe("renderBackgroundBlock", () => {
  it("renders the shared parchment block wrapper + block class vocabulary", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    // (1) wrapper carries the shared block wrapper class vocabulary
    expect(
      root.querySelector(".archivist-spell-block-wrapper.archivist-background-block-wrapper"),
    ).not.toBeNull();
    expect(root.querySelector(".archivist-spell-block.archivist-background-block")).not.toBeNull();
  });

  it("renders the name header with the parchment title class", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    // (2) the name header renders with the parchment title class
    expect(root.querySelector(".spell-name")?.textContent).toBe("Acolyte");
    expect(root.querySelector(".spell-school")?.textContent).toBe("Background");
  });

  it("renders a source badge via the sourceBadgeText path", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    // (3) a source badge renders (sourceBadgeText path)
    expect(root.querySelector(".source-badge")?.textContent).toBe("SRD 5e");
  });

  it("renders no source badge when edition and source are absent", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderBackgroundBlock({
        ...acolyte,
        edition: undefined,
        source: undefined,
      } as unknown as BackgroundEntity),
    );
    expect(root.querySelector(".source-badge")).toBeNull();
  });

  it("surfaces skill / tool / language proficiencies and the feature section", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    // (4) skill/tool/language proficiencies and the feature section render
    expect(root.textContent).toContain("Skills:");
    expect(root.textContent).toContain("Insight, Religion");
    expect(root.textContent).toContain("Tools:");
    // tokens are slugs in data, humanized via labelCase for display. The letter
    // after an embedded apostrophe must NOT be capitalized (regression: the old
    // \b\w pattern produced "Calligrapher'S Supplies" because ' is a word break).
    expect(root.textContent).toContain("Calligrapher's Supplies");
    expect(root.textContent).not.toContain("Calligrapher'S Supplies");
    expect(root.textContent).toContain("Languages:");
    // bare string sentinel "any" is free text, left untouched
    expect(root.textContent).toContain("Choose 2 (any)");
    expect(root.textContent).toContain("Equipment:");
    expect(root.textContent).toContain("Holy Symbol");
    expect(root.textContent).toContain("15 GP");
    // The feature renders as a named trait-style entry in the parchment idiom.
    const feature = root.querySelector(".race-trait-name");
    expect(feature?.textContent).toBe("Shelter of the Faithful");
    expect(root.textContent).toContain("respect of those who share your faith");
  });

  it("renders the description through the markdown pipeline", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    const desc = root.querySelector(".spell-description");
    expect(desc).not.toBeNull();
    expect(desc?.textContent).toContain("in the service of a");
  });

  it("humanizes hyphenated slug tokens in tool-choice, equipment, and language arms", async () => {
    // Slug-shaped tokens (as stored in the data) must surface humanized in the
    // user-facing card, mirroring the labelCase treatment applied to skills.
    const slugBg: BackgroundEntity = {
      ...acolyte,
      tool_proficiencies: [
        { kind: "choice", count: 1, from: ["cartographers-tools", "calligraphers-tools"] },
      ],
      language_proficiencies: [{ kind: "choice", count: 1, from: ["draconic", "elvish"] }],
      equipment: [
        { kind: "fixed", grants: [{ item: "traveling-satchel", qty: 1 }] },
        { kind: "fixed", grants: [{ item: "quill", qty: 3 }] },
        { kind: "gold", amount: 10 },
      ],
    } as unknown as BackgroundEntity;
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(slugBg));
    // (a) tool-choice `from` slugs humanized (labelCase: no apostrophes added)
    expect(root.textContent).toContain("Choose 1 (Cartographers Tools, Calligraphers Tools)");
    expect(root.textContent).not.toContain("cartographers-tools");
    // (b) equipment quantity branch (×N) humanizes the item slug
    expect(root.textContent).toContain("Quill ×3");
    expect(root.textContent).not.toContain("traveling-satchel");
    expect(root.textContent).toContain("Traveling Satchel");
    // (c) language-choice `from` slugs humanized; gold amount in GP
    expect(root.textContent).toContain("Choose 1 (Draconic, Elvish)");
    expect(root.textContent).toContain("10 GP");
  });

  it("does not capitalize the letter following an embedded apostrophe in slug labels", async () => {
    // Real vault data carries apostrophe-bearing tokens (Criminal.md:
    // thieves'-tools, traveler's-clothes). The post-apostrophe letter is
    // lowercase on ingest and must STAY lowercase through labelCase — the old
    // \b\w title-case treated ' as a word break and wrongly uppercased it.
    const apostropheBg: BackgroundEntity = {
      ...acolyte,
      tool_proficiencies: [{ kind: "fixed", items: ["thieves'-tools"] }],
      equipment: [
        { kind: "fixed", grants: [{ item: "traveler's-clothes", qty: 1 }] },
        { kind: "fixed", grants: [{ item: "calligrapher's-supplies", qty: 1 }] },
      ],
    } as unknown as BackgroundEntity;
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(apostropheBg));
    // "-" follows the apostrophe in thieves'-tools → already OK, but assert it.
    expect(root.textContent).toContain("Thieves' Tools");
    expect(root.textContent).not.toContain("Thieves' tools");
    // these two are the real regressions (a letter follows the apostrophe).
    expect(root.textContent).toContain("Traveler's Clothes");
    expect(root.textContent).not.toContain("Traveler'S Clothes");
    expect(root.textContent).toContain("Calligrapher's Supplies");
    expect(root.textContent).not.toContain("Calligrapher'S Supplies");
  });
});

describe("backgroundModule.render (async block + catch path)", () => {
  it("paints .archivist-block-error when the async block render rejects", async () => {
    const root = mountContainer();
    // (5) a thrown render failure paints `.archivist-block-error` (catch path).
    // Drive the real module render with a data shape that makes
    // renderBackgroundBlock reject (skill_proficiencies is not an array →
    // .map throws inside the async renderer, surfacing through .catch).
    const badData = { name: "Acolyte", skill_proficiencies: null } as unknown;
    backgroundModule.render(
      root,
      badData,
      { plugin: { app: {} }, ctx: null } as never,
    );
    await flush();
    expect(root.querySelector(".archivist-block-error")).not.toBeNull();
    expect(root.querySelector(".archivist-block-error")?.textContent).toContain("Acolyte");
  });
});
