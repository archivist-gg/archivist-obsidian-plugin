/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderBackgroundBlock } from "../packages/obsidian/src/modules/background/background.renderer";
import { backgroundModule } from "../packages/obsidian/src/modules/background/background.module";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";

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

// R4-G1a D5 / G9: the converter's passthrough grant keys on the note's Equipment line.
describe("renderBackgroundBlock · the fixed entry's Equipment text (R4-G1a D5, G9)", () => {
  const withEquipment = (equipment: unknown[]): BackgroundEntity =>
    ({ ...acolyte, equipment }) as unknown as BackgroundEntity;

  /** The `Equipment:` icon-property line, located by its label. */
  const equipLine = (root: HTMLElement) =>
    Array.from(root.querySelectorAll(".archivist-property-line-icon"))
      .find((l) => l.querySelector(".archivist-property-label")?.textContent === "Equipment:");

  it("prefers display_name and still humanizes the undecorated slug beside it", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(withEquipment([
      { kind: "fixed", grants: [
        { item: "holy-symbol", display_name: "holy symbol (a gift to you when you entered the priesthood)" },
        { item: "pouch", contains_value: 1500 },
      ] },
    ])));
    await flush();
    expect(root.textContent).toContain("holy symbol (a gift to you when you entered the priesthood)");
    // The undecorated item arm humanizes its slug, so the rendered token is "Pouch".
    expect(root.textContent).toContain("Pouch");
  });

  it("a fixed entry with no grants array renders with no throw and an empty Equipment value", async () => {
    const root = mountContainer();
    let block: HTMLElement | null = null;
    // This surface does NOT drop the line: it gates on `equipment.length`, not on the
    // joined text, so the label stays and only the value goes empty.
    await expect(
      (async () => { block = await renderBackgroundBlock(withEquipment([{ kind: "fixed" } as never])); })(),
    ).resolves.toBeUndefined();
    root.appendChild(block!);
    await flush();
    expect(equipLine(root)).toBeDefined();
    expect(equipLine(root)!.querySelector(".archivist-property-value")!.textContent).toBe("");
  });
});

// R4-G3b §10 (Task 11): the converter's `tables` and `suggested_characteristics`
// render on the entity note, inside the BLOCK element, so the
// `.archivist-background-block table.archivist-table` dress applies to them.
describe("renderBackgroundBlock · tables + suggested characteristics (R4-G3b §10)", () => {
  /** The corpus shape: 8 rows, `roll` a STRING on every row. */
  const ORIGIN_TABLE = {
    name: "Origin",
    dice: "d8",
    rows: Array.from({ length: 8 }, (_, i) => ({ roll: String(i + 1), text: `Origin ${i + 1}` })),
  };
  const charlatan: BackgroundEntity = {
    ...acolyte,
    slug: "phb-2014_charlatan",
    tables: [ORIGIN_TABLE],
    suggested_characteristics: { bonds: { "1": "a" } },
  } as unknown as BackgroundEntity;

  it("renders one table per `tables` entry plus one per numeric characteristics record", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(charlatan));
    await flush();
    const tables = root.querySelectorAll(".archivist-background-block table.archivist-table");
    // RED FIRST before Task 11 (df04139a): the note rendered neither field, so
    // this read 0.
    expect(tables).toHaveLength(2);
    expect(root.querySelectorAll("tbody tr")).toHaveLength(9);
    expect(Array.from(tables[0].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d8", "Origin"]);
    expect(Array.from(tables[1].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d1", "Bonds"]);
    expect(tables[0].querySelector("tbody tr td:last-child")?.textContent).toBe("Origin 1");
  });

  it("the control: no `tables` and `suggested_characteristics: null` renders NO table", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(acolyte));
    await flush();
    expect(root.querySelector("table")).toBeNull();
  });

  // R4-G3b Task 15 (rider): the converter emits the SAME roll table twice · as a
  // markdown pipe table inside `description` and as a structured `tables:` entry ·
  // and `renderMarkdownDescription` tags every rendered <table> `.archivist-table`,
  // so the note showed 84 of the corpus's 88 tables twice. The note path now
  // filters `tables` through `tablesNotInDescription`.
  const SCAM = { name: "Scam", dice: "d6", rows: [{ roll: "1", text: "I cheat at games of chance." }] };
  const CONTACT = { name: "Contact", dice: "d10", rows: [{ roll: "1", text: "A fence who owes you." }] };
  /** The Charlatan shape: the description carries `d6 | Scam` as a pipe table. */
  const EMBEDDED_DESC = [
    "You have always had a way with people.",
    "",
    "| d6 | Scam |",
    "| --- | --- |",
    "| 1 | I cheat at games of chance. |",
  ].join("\n");
  // Spread from `acolyte` (suggested_characteristics: null), NOT from `charlatan`
  // above, so every <table> counted below is a structured `tables:` entry and
  // nothing else. The jsdom obsidian mock renders markdown as textContent, so the
  // description's own pipe table never becomes a <table> here · what these two
  // cases measure is the DUPLICATE structured render, not the description copy.
  const embedded: BackgroundEntity = {
    ...acolyte,
    slug: "phb-2014_charlatan",
    description: EMBEDDED_DESC,
    tables: [SCAM, CONTACT],
    suggested_characteristics: null,
  } as unknown as BackgroundEntity;

  it("a table the description already embeds is dropped; the one the description omits survives", async () => {
    const root = mountContainer();
    root.appendChild(await renderBackgroundBlock(embedded));
    await flush();
    const tables = Array.from(root.querySelectorAll(".archivist-background-block table.archivist-table"));
    // RED FIRST at e2219ad3: the note rendered BOTH structured tables beside the
    // description's own copy of Scam, so this read 2.
    expect(tables).toHaveLength(1);
    expect(Array.from(tables[0].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d10", "Contact"]);
  });

  it("the control: with the pipe table removed from the description, BOTH structured tables render, Scam first", async () => {
    const root = mountContainer();
    const noEmbed = { ...embedded, description: "You have always had a way with people." } as unknown as BackgroundEntity;
    root.appendChild(await renderBackgroundBlock(noEmbed));
    await flush();
    const tables = Array.from(root.querySelectorAll(".archivist-background-block table.archivist-table"));
    expect(tables).toHaveLength(2);
    expect(Array.from(tables[0].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d6", "Scam"]);
    expect(Array.from(tables[1].querySelectorAll("th")).map((t) => t.textContent)).toEqual(["d10", "Contact"]);
  });
});
