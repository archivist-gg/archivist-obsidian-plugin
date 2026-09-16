/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import * as yaml from "js-yaml";

// The repo's partial-mock idiom: `Notice` becomes a spy while `setIcon` / `setTooltip` / `Setting` keep coming from
// the real mock, so the editor still renders.
vi.mock("obsidian", async (orig) => ({ ...(await orig()), Notice: vi.fn() }));

import { Notice } from "obsidian";
import { renderItemEditMode } from "../packages/obsidian/src/modules/item/item.edit-render";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => vi.mocked(Notice).mockClear());

/**
 * Every field the ONE clean builder emits, plus `slot`, an authored key it does NOT: the write assertion below is
 * what pins the collapsed builder (the editor carried a verbatim inline duplicate inside `saveAndExit` until
 * R4-G6b §4.2), so a field list that drifted between the two would be visible here.
 */
const item = { name: "Rope", type: "gear", rarity: "common", attunement: true, weight: 10, value: 100,
  damage: "1d4", damage_type: "bludgeoning", properties: ["finesse"], charges: 3, recharge: "dawn",
  curse: true, description: "A rope.", slot: "hand" } as never;

/** What `buildClean()` emits for the fixture above, in the builder's own field order. */
const CLEAN = { name: "Rope", type: "gear", rarity: "common", attunement: true, weight: 10, value: 100,
  damage: "1d4", damage_type: "bludgeoning", properties: ["finesse"], charges: 3, recharge: "dawn",
  curse: true, description: "A rope." };

function setup() {
  const el = mountContainer();
  const editor = { replaceRange: vi.fn(), getLine: () => "", setCursor: vi.fn() };
  const updateEntity = vi.fn().mockResolvedValue(undefined);
  const plugin = {
    app: { workspace: { activeEditor: { editor } } },
    compendiumManager: { getWritable: () => [{ name: "Me" }], saveEntity: vi.fn().mockResolvedValue({ slug: "me_item_x" }), updateEntity },
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

/** The YAML the editor wrote, parsed back out of the fenced block it replaced the range with. */
function written(call: unknown[]): unknown {
  return yaml.load(String(call[0]).replace(/^```item\n/, "").replace(/```$/, ""));
}

describe("renderItemEditMode: an unchanged save writes nothing (R4-G6b §4.2, Q-2)", () => {
  it("an untouched save writes nothing, says so and exits", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderItemEditMode(item, el, ctx as never, plugin as never, onExit);
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });

  it("a real edit still writes, and writes exactly the ONE clean builder's object", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderItemEditMode(item, el, ctx as never, plugin as never, onExit);
    type(el, "input.archivist-edit-input-name", "Silk rope");
    clickSave(el);
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(written(editor.replaceRange.mock.calls[0])).toEqual({ ...CLEAN, name: "Silk rope" });
  });

  it("an edit reverted by hand is unchanged again and writes nothing", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderItemEditMode(item, el, ctx as never, plugin as never, onExit);
    type(el, "input.archivist-edit-input-name", "Silk rope");
    type(el, "input.archivist-edit-input-name", "Rope");
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
  });

  it("the compendium branch: an untouched save never calls updateEntity", () => {
    const { el, plugin, updateEntity, ctx, onExit } = setup();
    renderItemEditMode(item, el, ctx as never, plugin as never, onExit, { slug: "s", compendium: "c", readonly: false });
    clickSave(el);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });
});
