/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { MarkdownRenderer } from "obsidian";
import type { Monster, MonsterSpellcasting } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../packages/obsidian/src/modules/monster/monster.renderer";
import { renderSpellcastingEntry } from "../packages/obsidian/src/modules/monster/monster.sections";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

/**
 * Q-11 (R4-G7 spec §7.6): every monster feature's prose renders through the markdown path, with the monster's
 * formula context threaded, and `renderMonsterBlock` returns `{ el, ready }` so a caller can await the fills.
 * Rows 9, 10 and 11 of the spec's kill-power floor live here; rows 9 and 10 were RUN RED before the route landed
 * (evidence `g7-t4-red-rows-9-11.txt`), row 11 is the CONTROL and is green by construction, its three fragments
 * MEASURED at the pre-change tree `main@54e0f93c` (evidence `g7-t4-row11-pins.txt`).
 */

beforeAll(() => installObsidianDomHelpers());

const ABIL = { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

/** The row-11 CONTROL pins, byte-for-byte as the pre-change tree drew them. */
const RECHARGE_NAME = '<span class="archivist-feature-name">Acid Breath (Recharge 5–6).</span>';
const ATTACK_BRANCH = '<span class="archivist-feature-attacks"><div class="archivist-monster-attack"><span class="archivist-monster-attack-bonus">+7 to hit</span>, reach 5 ft. <span class="archivist-monster-attack-damage">Hit: 2d6+4 slashing damage</span></div></span>';
const SPELLCASTING = '<div class="archivist-feature archivist-monster-spellcasting"><span class="archivist-feature-name">Spellcasting.</span><div class="archivist-feature-entry">The pinned one casts, save <span class="archivist-stat-tag archivist-stat-tag-dc" title="DC 15"><span class="archivist-stat-tag-icon"></span><span>DC 15</span></span>.</div><div class="archivist-feature-entry">At Will: mage hand</div></div>';

/** The two-feature monster the row-11 pins were measured on. */
function pinnedMonster(): Monster {
  return {
    name: "Pinned", abilities: ABIL, cr: "5",
    actions: [
      { name: "Acid Breath", entries: ["Exhales acid."], recharge: { type: "recharge_on_roll", param: 5 } },
      { name: "Claw", attacks: [{ name: "Claw", type: "melee", bonus: 7, damage: "2d6+4", damage_type: "slashing", range: { reach: 5 } }] },
    ],
  } as unknown as Monster;
}

/**
 * The jsdom obsidian mock renders markdown as bare `textContent`, so a backticked tag never becomes the `<code>`
 * element `renderMarkdownDescription`'s walker swaps for a widget. Real Obsidian emits one; this stand-in emits
 * exactly that and leaves every other run of the source a text node, which is what lets row 10 measure the
 * `monsterCtx` threading through the DEFAULT render instead of through an injected one.
 */
function emitCode(target: HTMLElement, source: string): void {
  const doc = target.ownerDocument;
  for (const part of source.split(/(`[^`]+`)/)) {
    if (part.length === 0) continue;
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = doc.createElement("code");
      code.textContent = part.slice(1, -1);
      target.appendChild(code);
    } else {
      target.appendChild(doc.createTextNode(part));
    }
  }
}

describe("Q-11 · monster feature prose through the markdown path (spec §7.6)", () => {
  it("row 9: the injected render's DOM lands inside .archivist-feature-entry, and `ready` resolves only after it", async () => {
    const seen: string[] = [];
    // The write is deferred by a REAL macrotask, so nothing but `await ready` can observe it: a `ready` that
    // resolves before the entries land (mutant m13) leaves the assertion below looking at an empty entry.
    const render = async (parent: HTMLElement, markdown: string): Promise<void> => {
      await new Promise((r) => setTimeout(r, 0));
      seen.push(markdown);
      const doc = parent.ownerDocument;
      const ul = doc.createElement("ul");
      for (const item of ["a", "b"]) {
        const li = doc.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      }
      parent.appendChild(ul);
    };
    const m = { name: "Lister", abilities: ABIL, traits: [{ name: "Bullets", entries: ["- a\n- b"] }] } as unknown as Monster;

    const { el, ready } = renderMonsterBlock(m, 1, undefined, { render });
    await ready;

    expect(el.querySelectorAll(".archivist-feature-entry ul li").length).toBe(2);
    expect(Array.from(el.querySelectorAll(".archivist-feature-entry ul li")).map((n) => n.textContent)).toEqual(["a", "b"]);
    expect(seen).toEqual(["- a\n- b"]);
  });

  it("row 9b: the entries of one feature reach the render joined as PARAGRAPHS, so a list entry stays a list", async () => {
    const seen: string[] = [];
    const render = (parent: HTMLElement, markdown: string): Promise<void> => { seen.push(markdown); return Promise.resolve(); };
    const m = { name: "Two", abilities: ABIL, traits: [{ name: "Both", entries: ["first", "- a\n- b"] }] } as unknown as Monster;

    const { ready } = renderMonsterBlock(m, 1, undefined, { render });
    await ready;

    expect(seen).toEqual(["first\n\n- a\n- b"]);
  });

  it("row 10: `atk:STR+PB` in a feature entry resolves to +7 through the DEFAULT render (the monsterCtx threading)", async () => {
    const spy = vi.spyOn(MarkdownRenderer, "render").mockImplementation(async (_app, source, target) => { emitCode(target, source); });
    try {
      // STR 18 is +4 and CR 5 is a proficiency bonus of +3, so `atk:STR+PB` resolves to +7.
      const m = { name: "Biter", abilities: ABIL, cr: "5", actions: [{ name: "Bite", entries: ["Melee Attack Roll: `atk:STR+PB`."] }] } as unknown as Monster;

      const { el, ready } = renderMonsterBlock(m, 1);
      await ready;

      const entry = el.querySelector(".archivist-feature-entry");
      expect(entry?.textContent).toContain("+7");
      expect(entry?.querySelector(".archivist-stat-tag-atk")).not.toBeNull();
      expect(entry?.querySelector("code")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("row 11 (CONTROL): the recharge suffix, the attack branch and renderSpellcastingEntry stay byte-identical", async () => {
    const { el, ready } = renderMonsterBlock(pinnedMonster(), 1);
    await ready;
    const cards = Array.from(el.querySelectorAll(".archivist-feature"));

    expect((cards[0].querySelector(".archivist-feature-name") as HTMLElement).outerHTML).toBe(RECHARGE_NAME);
    expect((cards[1].querySelector(".archivist-feature-attacks") as HTMLElement).outerHTML).toBe(ATTACK_BRANCH);

    const host = document.createElement("div");
    const block: MonsterSpellcasting = { name: "Spellcasting", headerEntries: ["The pinned one casts, save `dc:STR`."], will: [{ entry: "mage hand" } as never] };
    renderSpellcastingEntry(host, block, { abilities: ABIL, proficiencyBonus: 3 });
    expect((host.firstElementChild as HTMLElement).outerHTML).toBe(SPELLCASTING);
  });

  it("row 11 (CONTROL): a markdown section that renders through the new route emits no .archivist-block-error", async () => {
    const m = { ...pinnedMonster(), lair_actions: ["The lair shifts."] } as unknown as Monster;

    const { el, ready } = renderMonsterBlock(m, 1);
    await ready;

    expect(el.querySelector(".archivist-block-error")).toBeNull();
    const pane = el.querySelector('[data-fill="markdown"]');
    expect(pane?.textContent).toContain("The lair shifts.");
  });
});
