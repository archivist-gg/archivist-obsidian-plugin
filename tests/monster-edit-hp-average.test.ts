/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// The repo's partial-mock idiom (`tests/monster-edit-unchanged.test.ts`): `Notice` becomes a spy while `setIcon` /
// `setTooltip` / `Setting` keep coming from the real mock, so the editors still render.
vi.mock("obsidian", async (orig) => ({ ...(await orig()), Notice: vi.fn() }));

import { Notice } from "obsidian";
import { MonsterEditState, monsterToEditable, recalculate } from "../packages/obsidian/src/modules/monster/monster.edit-state";
import { renderMonsterEditMode } from "../packages/obsidian/src/modules/monster/edit/monster-edit-render";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());
beforeEach(() => vi.mocked(Notice).mockClear());

/**
 * R4-G7 §7.4 · the Donkey's HP shape (`2d8+2`, average 11) on a CON of 10, so the AUTHORED average (11, which
 * carries the formula's flat +2) is deliberately NOT the value the dice recompute writes (9: `parseHitDiceFormula`
 * drops the flat bonus). A fixed-point fixture like `tests/monster-edit-unchanged.test.ts`'s 66 / `12d10+34` could
 * never go RED here, so this one is a non-fixed point on purpose. The ability line is a hand fixture, not the SRD's.
 */
const DONKEY = { name: "Donkey", size: "Medium", ac: [{ ac: 17 }], hp: { average: 11, formula: "2d8+2" },
  speed: { walk: 40 }, abilities: { str: 12, dex: 10, con: 10, int: 2, wis: 10, cha: 5 },
  traits: [{ name: "t", entries: ["e"] }] } as never;

describe("recalculate: hp.average is re-derived for the HP_FIELDS edits only (R4-G7 §7.4)", () => {
  it("an AC, CR, speed, name, saves, skills or senses edit leaves the authored average alone", () => {
    const e = monsterToEditable(DONKEY);
    expect(recalculate(e, "ac").hp?.average).toBe(11);        // m10's kill row
    expect(recalculate(e, "cr").hp?.average).toBe(11);
    expect(recalculate(e, "speed").hp?.average).toBe(11);
    expect(recalculate(e, "name").hp?.average).toBe(11);
    expect(recalculate(e, "saves.dex").hp?.average).toBe(11);
    expect(recalculate(e, "skills.stealth").hp?.average).toBe(11);
    expect(recalculate(e, "senses").hp?.average).toBe(11);
    expect(recalculate(e, "ac").hp?.formula).toBe("2d8+2");   // and the formula is never touched either
  });

  it("a formula edit recomputes, and the combat editor's second call under \"hp\" recomputes again", () => {
    const e = monsterToEditable(DONKEY);
    const afterFormula = recalculate(e, "hp.formula");
    expect(afterFormula.hp?.average).toBe(9);
    // `edit/combat-editor.ts:70-71` fires `updateField("hp.formula", …)` and `updateField("hp", hp)` back to back,
    // and the second call carries the PRE-edit average, so `"hp"` has to recompute too.
    const carried = { ...afterFormula, hp: { ...afterFormula.hp!, average: 11 } };
    expect(recalculate(carried, "hp").hp?.average).toBe(9);
  });

  it("a size edit re-dies the formula and recomputes the average from the new die", () => {
    const e = { ...monsterToEditable(DONKEY), size: "Small" };
    const r = recalculate(e, "size");
    expect(r.hp?.formula).toBe("2d6");
    expect(r.hp?.average).toBe(7);
  });

  it("an abilities edit recomputes through the whole-object field name the abilities editor sends", () => {
    // `edit/abilities-editor.ts:41` is the ONLY writer: `state.updateField("abilities", abilities)`.
    const e = monsterToEditable(DONKEY);
    e.abilities!.con = 14;
    expect(recalculate(e, "abilities").hp?.average).toBe(13);
  });

  it("CHARACTERISATION of the override path: clearOverride(\"hp\") restores the dice average", () => {
    // Green by construction (the `!overrides.has("hp")` guard already shipped); pinned because the field set now
    // sits in front of it and `clearOverride("hp")` is the "(Auto)" restore's only route.
    const s = new MonsterEditState(DONKEY, () => {});
    const hp = { ...s.current.hp!, average: 99 };          // the `edit/combat-editor.ts:54-57` order
    s.setOverride("hp", 99);
    s.updateField("hp", hp);
    expect(s.current.hp?.average).toBe(99);
    s.clearOverride("hp");
    expect(s.current.hp?.average).toBe(9);
  });
});

describe("renderMonsterEditMode: an AC edit reverted by hand is unchanged again (R4-G7 §7.4, Q-2)", () => {
  /** The bar is re-rendered on every state change, so the Save button is re-queried at click time. */
  const clickSave = (el: HTMLElement): void => (el.querySelector(".archivist-side-btn-save") as HTMLElement).click();

  /** The FIRST `input.archivist-num-in` in the rendered block is the AC field (`combat-editor.ts:25`). */
  function setAc(el: HTMLElement, value: string): void {
    const ac = el.querySelector("input.archivist-num-in") as HTMLInputElement;
    ac.value = value;
    ac.dispatchEvent(new Event("input"));
  }

  function setup() {
    const el = mountContainer();
    const editor = { replaceRange: vi.fn(), getLine: () => "", setCursor: vi.fn() };
    const plugin = {
      app: { workspace: { activeEditor: { editor } } },
      compendiumManager: { getWritable: () => [{ name: "Me" }], saveEntity: vi.fn().mockResolvedValue({ slug: "me_monster_x" }), updateEntity: vi.fn().mockResolvedValue(undefined) },
    };
    const ctx = { getSectionInfo: () => ({ lineStart: 0, lineEnd: 3 }) };
    return { el, editor, plugin, ctx, onExit: vi.fn() };
  }

  it("open, edit AC, revert: the save compares unchanged and writes nothing", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(DONKEY, el, ctx as never, plugin as never, onExit);
    setAc(el, "52");
    setAc(el, "17");
    clickSave(el);
    expect(editor.replaceRange).not.toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith("No changes");
  });

  it("a real AC edit still writes", () => {
    const { el, editor, plugin, ctx, onExit } = setup();
    renderMonsterEditMode(DONKEY, el, ctx as never, plugin as never, onExit);
    setAc(el, "52");
    clickSave(el);
    expect(editor.replaceRange).toHaveBeenCalledTimes(1);
    expect(editor.replaceRange.mock.calls[0][0]).toContain("ac: 52");
  });
});
