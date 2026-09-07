/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { MonsterEditState } from "../packages/obsidian/src/modules/monster/monster.edit-state";
import { renderHeader, renderLanguagesAndCR, mergeQualifierSelection } from "../packages/obsidian/src/modules/monster/edit/info-editor";
import { renderCombat } from "../packages/obsidian/src/modules/monster/edit/combat-editor";
import type { DomRefs } from "../packages/obsidian/src/modules/monster/edit/types";
import { renderMonsterBlock } from "../packages/obsidian/src/modules/monster/monster.renderer";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

/** R4-G6 §9 (T3 half): the header editor DISPLAYS a structured size / type / alignment through the dnd5e formatters
 *  and no longer throws. The fixture is built directly (not through the codec, which stringifies these until T4). */
describe("renderHeader on a structured monster (R4-G6 §9)", () => {
  const structured = {
    name: "Aspect of Tiamat", size: ["G"], type: { type: "dragon", tags: ["chromatic"] }, alignment: ["C", "E"], cr: "30",
    abilities: { str: 30, dex: 14, con: 30, int: 21, wis: 20, cha: 26 },
  } as unknown as Monster;

  function render(m: Monster): HTMLElement {
    const state = new MonsterEditState(m, () => {});
    const host = document.createElement("div");
    renderHeader(host, state);
    return host;
  }

  it("does not throw and shows the decoded size, type and alignment", () => {
    const host = render(structured);
    const size = host.querySelector("select") as HTMLSelectElement;
    expect(size.value).toBe("gargantuan");
    const typeInput = host.querySelector("input.archivist-edit-input") as HTMLInputElement;
    expect(typeInput.value).toBe("Dragon (Chromatic)");
    const selects = host.querySelectorAll("select");
    expect((selects[1] as HTMLSelectElement).value).toBe("chaotic");
    expect((selects[2] as HTMLSelectElement).value).toBe("evil");
  });

  it("the CR select matches a structured cr (a tsc-invisible read; an unrouted select falls back to its FIRST option, value 0)", () => {
    const state = new MonsterEditState({ ...structured, cr: { cr: "11", xp_lair: 8400 } } as unknown as Monster, () => {});
    const host = document.createElement("div");
    renderLanguagesAndCR(host, state, {} as DomRefs);
    const crSelect = host.querySelector("select") as HTMLSelectElement;
    expect(crSelect.value).toBe("11");
    expect(crSelect.selectedIndex).toBe(14);   // ALL_CR_VALUES.indexOf("11")
    // The XP text comes from dnd5e's `formatXP` now that the editor's `toLocaleString` twin is retired. GREEN at its
    // first run: the two agree under an en locale, so its kill power is over a dropped or broken re-export, not over
    // the locale divergence that motivated the retirement.
    expect(host.querySelector(".archivist-auto-value")?.textContent).toBe("7,200");
  });

  it("the combat editor shows the numeric part of an object speed (tsc-invisible reads)", () => {
    const m = { ...structured, speed: { walk: { number: 30, condition: "in bat form" }, fly: { number: 60, condition: "(hover)" } } } as unknown as Monster;
    const state = new MonsterEditState(m, () => {});
    const host = document.createElement("div");
    renderCombat(host, state, {} as DomRefs);          // renderCombat only WRITES refs.hpValue / refs.hpFormula
    const inputs = host.querySelectorAll("input.archivist-num-in");
    const walk = inputs[1] as HTMLInputElement;         // AC first, then walk (the input carries no hook of its own)
    expect(walk.value).toBe("30");
    const flyRow = host.querySelector('[data-speed-mode="fly"] input') as HTMLInputElement | null;
    expect(flyRow?.value).toBe("60");
  });

  it("routing scope: a property value with markdown emphasis but no wikilink stays a TEXT node (the four SRD 5e notes)", () => {
    const m = { name: "Archmage", ac: [{ ac: 12, from: ["15 with _mage armor_"] }], abilities: structured.abilities } as unknown as Monster;
    const block = renderMonsterBlock(m, 1);
    const ac = Array.from(block.querySelectorAll(".property-line")).find((l) => l.querySelector("h4")?.textContent === "Armor Class")!;
    expect(ac.querySelector("p")!.innerHTML).toBe("12 (15 With _mage Armor_)");
  });

  it("a multi-select edit keeps the structured qualifier entries (spec §9, row 48)", () => {
    expect(mergeQualifierSelection(["acid", { types: ["fire"] }], ["cold"])).toEqual([{ types: ["fire"] }, "cold"]);
    expect(mergeQualifierSelection(undefined, ["cold"])).toEqual(["cold"]);
  });
  it("leaves the moral select empty on a non-splitting alignment (today's behaviour, accepted)", () => {
    const host = render({ ...structured, alignment: "any non-good alignment" } as unknown as Monster);
    const selects = host.querySelectorAll("select");
    expect((selects[1] as HTMLSelectElement).value).toBe("any");
    expect((selects[2] as HTMLSelectElement).selectedIndex).toBe(-1);
  });
});
