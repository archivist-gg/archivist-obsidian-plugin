/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  allTicked, matchesTicked, renderCompendiumFilter, sourceTagCls, renderSourceTag,
} from "../src/modules/pc/components/builder/compendium-filter";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { Compendium } from "../src/shared/entities/compendium-manager";
import type { RegisteredEntity } from "../src/shared/entities/entity-registry";

beforeAll(() => installObsidianDomHelpers());

const comp = (name: string, homebrew = false): Compendium =>
  ({ name, description: "", readonly: !homebrew, homebrew, folderPath: `Compendium/${name}` });

const ent = (compendium: string, homebrew: boolean, edition?: string): RegisteredEntity =>
  ({
    slug: "x", name: "X", entityType: "race", filePath: "f.md",
    data: edition ? { edition } : {}, compendium, readonly: !homebrew, homebrew,
  });

describe("compendium filter", () => {
  it("starts with every compendium ticked", () => {
    const st = allTicked([comp("SRD 5e"), comp("SRD 2024"), comp("Me", true)]);
    expect(st.ticked.size).toBe(3);
    expect(matchesTicked(ent("SRD 5e", false, "2014"), st)).toBe(true);
  });

  it("unticking a chip hides that compendium and re-ticking restores it", () => {
    const root = mountContainer();
    const cs = [comp("SRD 5e"), comp("Me", true)];
    const st = allTicked(cs);
    const draw = vi.fn();
    renderCompendiumFilter(root, cs, st, draw);
    const chips = root.querySelectorAll<HTMLElement>(".pc-bfilter-chip");
    expect(chips.length).toBe(2);
    chips[1].click();
    expect(st.ticked.has("Me")).toBe(false);
    expect(matchesTicked(ent("Me", true), st)).toBe(false);
    expect(draw).toHaveBeenCalledTimes(1);
    chips[1].click();
    expect(st.ticked.has("Me")).toBe(true);
    expect(matchesTicked(ent("Me", true), st)).toBe(true);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it("hides entities whose compendium is not in the tick state", () => {
    const st = allTicked([comp("SRD 5e")]);
    expect(matchesTicked(ent("Unknown Comp", false), st)).toBe(false);
  });

  it("colour-keys tags: homebrew green class, 2024 blue class, else grey class", () => {
    expect(sourceTagCls(ent("Me", true, "2024"))).toBe("hb");
    expect(sourceTagCls(ent("SRD 2024", false, "2024"))).toBe("e2024");
    expect(sourceTagCls(ent("SRD 5e", false, "2014"))).toBe("e2014");
    expect(sourceTagCls(ent("SRD 5e", false))).toBe("e2014");
  });

  it("tag text is always the compendium name", () => {
    const root = mountContainer();
    renderSourceTag(root, ent("SRD 2024", false, "2024"));
    const tag = root.querySelector(".pc-bsrc")!;
    expect(tag.textContent).toBe("SRD 2024");
    expect(tag.classList.contains("e2024")).toBe(true);
  });
});
