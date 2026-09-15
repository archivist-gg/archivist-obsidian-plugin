/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderStandardActionsList } from "../packages/obsidian/src/modules/pc/components/actions/standard-actions-list";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import { STANDARD_ACTIONS } from "@archivist-gg/dnd5e/dnd/constants";

beforeAll(() => installObsidianDomHelpers());

const ctxFor = (edition?: string): ComponentRenderContext =>
  ({ resolved: { definition: edition ? { edition } : {} }, derived: {} }) as unknown as ComponentRenderContext;

const bodyOf = (root: HTMLElement): string => root.querySelector(".pc-standard-actions-body")?.textContent ?? "";

// R4-G7 T8 RIDER-22 (F-STDACT): the list is dnd5e's `STANDARD_ACTIONS[edition]`, read from the character. The block used to
// print ONE hardcoded 16-name union of both editions to every character.
describe("StandardActionsList", () => {
  it("a 2014 character reads the 2014 actions: Use an Object, never Utilize", () => {
    const root = mountContainer();
    renderStandardActionsList(root, ctxFor("2014"));
    expect(bodyOf(root)).toContain("Use an Object");
    expect(bodyOf(root)).not.toContain("Utilize");
    expect(bodyOf(root)).toBe(`${STANDARD_ACTIONS["2014"].join(", ")}.`);
  });

  it("a 2024 character reads the 2024 actions: Utilize, never Cast a Spell", () => {
    const root = mountContainer();
    renderStandardActionsList(root, ctxFor("2024"));
    expect(bodyOf(root)).not.toContain("Cast a Spell");
    expect(bodyOf(root)).toContain("Utilize");
    expect(bodyOf(root)).toBe(`${STANDARD_ACTIONS["2024"].join(", ")}.`);
  });

  it("keeps the block title", () => {
    const root = mountContainer();
    renderStandardActionsList(root, ctxFor("2024"));
    expect(root.querySelector(".pc-standard-actions-title")?.textContent?.toLowerCase()).toContain("standard combat actions");
  });

  it("a definition with no known edition prints no list at all rather than guessing one", () => {
    const root = mountContainer();
    renderStandardActionsList(root, ctxFor());
    expect(root.querySelector(".pc-standard-actions")).toBeNull();
  });
});
