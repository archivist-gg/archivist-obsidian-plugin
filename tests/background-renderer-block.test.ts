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
  tool_proficiencies: [{ kind: "fixed", items: ["Calligrapher's Supplies"] }],
  language_proficiencies: [{ kind: "choice", count: 2, from: "any" }],
  equipment: [
    { item: "Holy Symbol", quantity: 1 },
    { kind: "currency", gp: 15 },
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
    expect(root.textContent).toContain("Calligrapher's Supplies");
    expect(root.textContent).toContain("Languages:");
    expect(root.textContent).toContain("Choose 2 (any)");
    expect(root.textContent).toContain("Equipment:");
    expect(root.textContent).toContain("Holy Symbol");
    expect(root.textContent).toContain("15 gp");
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
