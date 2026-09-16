/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// The repo's partial-mock idiom: `Notice` becomes a spy while `setIcon` / `setTooltip` / `Setting` keep coming from
// the real mock, so the editor still renders.
vi.mock("obsidian", async (orig) => ({ ...(await orig()), Notice: vi.fn() }));

import { Notice } from "obsidian";
import { renderSpellEditMode } from "../packages/obsidian/src/modules/spell/spell.edit-render";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => vi.mocked(Notice).mockClear());

/**
 * The T4 spell fixture plus the key the At-higher-levels leg needs: `buildSpellYamlObject` assigns
 * `clean.at_higher_levels = draft.at_higher_levels`, the SAME array the textarea writes into IN PLACE, so this
 * fixture is what makes an un-cloned snapshot observable (spec §4.2).
 */
const spell = { name: "Fire Bolt", at_higher_levels: ["A"] } as never;

function setup() {
  const el = mountContainer();
  const editor = { replaceRange: vi.fn(), getLine: () => "", setCursor: vi.fn() };
  const updateEntity = vi.fn().mockResolvedValue(undefined);
  const plugin = {
    app: { workspace: { activeEditor: { editor } } },
    compendiumManager: { getWritable: () => [{ name: "Me" }], saveEntity: vi.fn().mockResolvedValue({ slug: "me_spell_x" }), updateEntity },
  };
  const ctx = { getSectionInfo: () => ({ lineStart: 0, lineEnd: 3 }) };
  const onExit = vi.fn();
  return { el, editor, plugin, updateEntity, ctx, onExit };
}

/** The bar is re-rendered on every state change, so the Save button is re-queried at click time. */
const clickSave = (el: HTMLElement): void => (el.querySelector(".archivist-side-btn-save") as HTMLElement).click();

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("renderSpellEditMode: an unchanged save writes nothing (R4-G6b §4.2, Q-2)", () => {
  it("an untouched save writes nothing, says so and exits", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderSpellEditMode(spell, el, ctx as never, plugin as never, onExit);
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });

  it("a real edit still writes", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderSpellEditMode(spell, el, ctx as never, plugin as never, onExit);
    type(el, ".spell-classes input.archivist-edit-input", "Wizard");
    clickSave(el);
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(editor.replaceRange.mock.calls[0][0]).toContain("Wizard");
  });

  it("an edit reverted by hand is unchanged again and writes nothing", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderSpellEditMode(spell, el, ctx as never, plugin as never, onExit);
    type(el, ".spell-classes input.archivist-edit-input", "Wizard");
    type(el, ".spell-classes input.archivist-edit-input", "");
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
  });

  // m11's kill row: the At-higher-levels textarea writes into the array the snapshot would SHARE without the deep
  // copy, so an un-cloned snapshot compares EQUAL here and destroys the edit (226 shipped notes carry the key).
  it("an At-higher-levels edit is a change and is written", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderSpellEditMode(spell, el, ctx as never, plugin as never, onExit);
    type(el, ".spell-higher-levels textarea", "B");
    clickSave(el);
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(editor.replaceRange.mock.calls[0][0]).toContain("B");
  });

  it("the compendium branch: an untouched save never calls updateEntity", () => {
    const { el, plugin, updateEntity, ctx, onExit } = setup();
    renderSpellEditMode(spell, el, ctx as never, plugin as never, onExit, { slug: "s", compendium: "c", readonly: false });
    clickSave(el);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });
});
