/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// The repo's partial-mock idiom: `Notice` becomes a spy while `setIcon` / `setTooltip` / `Setting` keep coming from
// the real mock, so the editors still render.
vi.mock("obsidian", async (orig) => ({ ...(await orig()), Notice: vi.fn() }));

import { Notice } from "obsidian";
import { renderMonsterEditMode } from "../packages/obsidian/src/modules/monster/edit/monster-edit-render";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => vi.mocked(Notice).mockClear());

/**
 * The editors' fixture (T4 Step 4) with ONE number changed: every key a leg reads is PRESENT, and `hp.average` is
 * the value `recalculate` derives from the formula (MEASURED: `12d10+34` with CON 10 re-derives to 66, because
 * `parseHitDiceFormula` carries no flat bonus), so the fixture is a FIXED POINT of the editor's own recalculation
 * and the revert leg can compare equal. T4's `average: 100` is not a fixed point: a formula, size or
 * abilities edit rewrites it to 66 (evidence `g6b-t5-hp-recalc-measurement.txt`). Since R4-G7 §7.4 an AC edit is
 * no longer one of them, so the revert leg holds on a non-fixed-point fixture too
 * (`tests/monster-edit-hp-average.test.ts`).
 */
const monster = { name: "Aspect", ac: [{ ac: 17 }], hp: { average: 66, formula: "12d10+34" },
  speed: { walk: 30 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  traits: [{ name: "t", entries: ["e"] }] } as never;

function setup() {
  const el = mountContainer();
  const editor = { replaceRange: vi.fn(), getLine: () => "", setCursor: vi.fn() };
  const updateEntity = vi.fn().mockResolvedValue(undefined);
  const plugin = {
    app: { workspace: { activeEditor: { editor } } },
    compendiumManager: { getWritable: () => [{ name: "Me" }], saveEntity: vi.fn().mockResolvedValue({ slug: "me_monster_x" }), updateEntity },
  };
  const ctx = { getSectionInfo: () => ({ lineStart: 0, lineEnd: 3 }) };
  const onExit = vi.fn();
  return { el, editor, plugin, updateEntity, ctx, onExit };
}

/** The bar is re-rendered on every state change, so the Save button is re-queried at click time. */
const clickSave = (el: HTMLElement): void => (el.querySelector(".archivist-side-btn-save") as HTMLElement).click();

/** The FIRST `input.archivist-num-in` in the rendered block is the AC field (`combat-editor.ts`). */
function setAc(el: HTMLElement, value: string): void {
  const ac = el.querySelector("input.archivist-num-in") as HTMLInputElement;
  ac.value = value;
  ac.dispatchEvent(new Event("input"));
}

describe("renderMonsterEditMode: an unchanged save writes nothing (R4-G6b §4.2, Q-2)", () => {
  it("an untouched save writes nothing, says so and exits", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit);
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });

  it("a real edit still writes", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit);
    setAc(el, "52");
    clickSave(el);
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(editor.replaceRange.mock.calls[0][0]).toContain("ac: 52");
  });

  it("an edit reverted by hand is unchanged again and writes nothing", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit);
    setAc(el, "52");
    setAc(el, "17");
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
  });

  it("an added empty section emits nothing, so its save writes nothing", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit);
    (el.querySelector(".archivist-tab.add-tab") as HTMLElement).click();
    const items = Array.from(el.querySelectorAll(".archivist-section-dropdown-item"));
    const lair = items.find((b) => b.textContent === "Lair Actions") as HTMLElement;
    lair.click();
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
  });

  it("the compendium branch: an untouched save never calls updateEntity", () => {
    const { el, plugin, updateEntity, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit, { slug: "s", compendium: "c", readonly: false });
    clickSave(el);
    expect(updateEntity).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
    expect(onExit).toHaveBeenCalled();
  });
});
