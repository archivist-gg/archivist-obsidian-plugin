/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderFeatBlock } from "../src/modules/feat/feat.renderer";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { FeatEntity } from "../src/modules/feat/feat.types";

beforeAll(() => installObsidianDomHelpers());

const feat: FeatEntity = {
  slug: "srd-5e_grappler", name: "Grappler", edition: "2014", source: "SRD 5.1",
  category: "general", description: "You've developed the **skills** necessary to hold your own.",
  prerequisites: [{ kind: "ability", ability: "strength", min: 13 }],
  benefits: ["Advantage on attack rolls against a creature you are grappling."],
  effects: [], grants_asi: null, repeatable: false, choices: [],
} as unknown as FeatEntity;

describe("renderFeatBlock", () => {
  it("renders the shared parchment block with name, category header, and source badge", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock(feat));
    expect(root.querySelector(".archivist-spell-block.archivist-feat-block")).not.toBeNull();
    expect(root.querySelector(".spell-name")?.textContent).toBe("Grappler");
    expect(root.querySelector(".spell-school")?.textContent).toBe("General Feat");
    expect(root.querySelector(".source-badge")?.textContent).toBe("SRD 5e");
  });

  it("renders prerequisites as readable text, not JSON", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock(feat));
    expect(root.textContent).toContain("Strength 13+");
    expect(root.textContent).not.toContain('{"kind"');
  });

  it("renders the benefits list", async () => {
    const root = mountContainer();
    root.appendChild(await renderFeatBlock(feat));
    const items = root.querySelectorAll(".feat-benefits li");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("Advantage on attack rolls");
  });

  it("de-hyphenates a hyphenated category in the header", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderFeatBlock({ ...feat, category: "fighting-style" } as unknown as FeatEntity),
    );
    expect(root.querySelector(".spell-school")?.textContent).toBe("Fighting Style Feat");
  });

  it("shows Repeatable and omits Prerequisites when there are none", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderFeatBlock({ ...feat, prerequisites: [], repeatable: true } as unknown as FeatEntity),
    );
    expect(root.textContent).toContain("Repeatable:");
    expect(root.textContent).toContain("Yes");
    expect(root.textContent).not.toContain("Prerequisites:");
  });

  it("renders no source badge when edition and source are absent", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderFeatBlock({ ...feat, edition: undefined, source: undefined } as unknown as FeatEntity),
    );
    expect(root.querySelector(".source-badge")).toBeNull();
  });

  it("renders a slug prerequisite as a readable name", async () => {
    const root = mountContainer();
    root.appendChild(
      await renderFeatBlock({
        ...feat,
        prerequisites: [{ kind: "race", slug: "srd-5e_high-elf" }],
      } as unknown as FeatEntity),
    );
    expect(root.textContent).toContain("High Elf");
  });
});
