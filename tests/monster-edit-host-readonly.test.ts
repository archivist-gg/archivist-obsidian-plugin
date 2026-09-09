/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderMonsterEditMode } from "../packages/obsidian/src/modules/monster/edit/monster-edit-render";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

// The Save-as-new picker: the plugin's `getWritable` returns ONE compendium, so `SaveAsNewModal` opens; the stub
// answers it immediately with that compendium and a new name.
vi.mock("../packages/obsidian/src/shared/entities/compendium-modal", () => ({ SaveAsNewModal: class { constructor(_a: unknown, _w: unknown, _n: string, cb: (c: { name: string }, n: string) => void) { this.cb = cb; } cb: (c: { name: string }, n: string) => void; open() { this.cb({ name: "Me" }, "New name"); } }, CreateCompendiumModal: class { open() {} } }));

beforeAll(() => installObsidianDomHelpers());

/** The editors' fixture: every key a leg reads must be PRESENT (see T4 Step 4 / T5 Step 2). */
const monster = { name: "Aspect", ac: [{ ac: 17 }], hp: { average: 100, formula: "12d10+34" },
  speed: { walk: 30 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  traits: [{ name: "t", entries: ["e"] }] } as never;

function setup() {
  const el = mountContainer();
  const editor = { replaceRange: vi.fn(), getLine: () => "", setCursor: vi.fn() };
  const plugin = {
    app: { workspace: { activeEditor: { editor } } },
    compendiumManager: { getWritable: () => [{ name: "Me" }], saveEntity: vi.fn().mockResolvedValue({ slug: "me_monster_x" }) },
  };
  const ctx = { getSectionInfo: () => ({ lineStart: 0, lineEnd: 3 }) };
  const onExit = vi.fn();
  return { el, editor, plugin, ctx, onExit };
}

describe("renderMonsterEditMode on a readonly host (R4-G6b §3.4)", () => {
  it("the editor renders its side-button bar under the obsidian mock (the smoke check)", () => {
    const { el, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit);
    expect(el.querySelector(".archivist-side-btns")).not.toBeNull();
  });

  it("hostReadonly: Save-as-new saves the new entity and NEVER writes the host note", async () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit, undefined, undefined, true);
    (el.querySelector(".archivist-side-btn-save-as-new") as HTMLElement).click();
    await Promise.resolve(); await Promise.resolve();
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(plugin.compendiumManager.saveEntity).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalled();
  });

  // The control. The code-block `pending` bar never renders Save-as-new without the flag (spec §3.4's NOTE), so the
  // SAME `saveTo` closure is driven through the `compendium-pending` bar with `onReplaceRef` ABSENT: the flag off, the
  // fence replacement happens.
  it("without the flag Save-as-new replaces the fence with the ref (the control)", async () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(monster, el, ctx as never, plugin as never, onExit, { slug: "old_monster_x", compendium: "Me", readonly: false }, undefined);
    (el.querySelector(".archivist-side-btn-save-as-new") as HTMLElement).click();
    await Promise.resolve(); await Promise.resolve();
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(editor.replaceRange.mock.calls[0][0]).toContain("{{monster:me_monster_x}}");
    expect(plugin.compendiumManager.saveEntity).toHaveBeenCalledTimes(1);
  });
});
