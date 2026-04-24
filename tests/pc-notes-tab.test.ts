/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { NotesTab } from "../src/modules/pc/components/notes-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../src/modules/pc/components/component.types";
import type { DerivedStats, ResolvedCharacter } from "../src/modules/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

function mkResolved(notes?: string): ResolvedCharacter {
  const state = { hp: { current: 1, max: 1, temp: 0 }, hit_dice: {}, spell_slots: {}, concentration: null, conditions: [] };
  return {
    definition: {
      name: "T", edition: "2014", race: null, subrace: null, background: null, class: [],
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ability_method: "manual",
      skills: { proficient: [], expertise: [] }, spells: { known: [], overrides: [] },
      equipment: [], overrides: {}, notes, state,
    } as never,
    race: null, classes: [], background: null, feats: [], totalLevel: 0, features: [], state,
  };
}

function mkCtx(notes?: string): ComponentRenderContext {
  return { resolved: mkResolved(notes), derived: {} as DerivedStats, core: {} as never, editState: null };
}

describe("NotesTab", () => {
  it("renders the notes markdown into the tab body", () => {
    const container = mountContainer();
    new NotesTab().render(container, mkCtx("# Hello\n\nWorld."));
    const body = container.querySelector(".pc-notes-body");
    expect(body).not.toBeNull();
    const md = container.querySelector(".pc-notes-markdown");
    expect(md?.textContent).toBe("# Hello\n\nWorld.");
  });
  it("shows an empty line when notes are missing", () => {
    const container = mountContainer();
    new NotesTab().render(container, mkCtx());
    expect(container.querySelector(".pc-empty-line")).not.toBeNull();
    expect(container.querySelector(".pc-notes-markdown")).toBeNull();
  });
  it("shows an empty line when notes are only whitespace", () => {
    const container = mountContainer();
    new NotesTab().render(container, mkCtx("   \n  \t"));
    expect(container.querySelector(".pc-empty-line")).not.toBeNull();
    expect(container.querySelector(".pc-notes-markdown")).toBeNull();
  });
});
