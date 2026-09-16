/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MarkdownRenderer } from "obsidian";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../packages/obsidian/src/modules/monster/monster.renderer";
import { replaceInlineTagCodes } from "../packages/obsidian/src/shared/rendering/inline-tag-renderer";
import { installObsidianDomHelpers } from "./fixtures/pc/dom-helpers";

/**
 * R4-G7 T8 wave E, B026-D11 (the G7 regression of T4 `da091724`): an ability-keyed `dc:` / `check:` tag printed the
 * ABILITY ("DC INT") instead of the computed number on 279 SRD monster notes (SRD 2024: 138 of 331 notes / 188 tags;
 * SRD 5e: 141 of 325 / 184).
 *
 * WHY NOTHING CAUGHT IT, and what this file does differently. Every other jsdom test of the monster prose INJECTS a
 * render (`opts.render`) or mocks `MarkdownRenderer.render` to emit bare `<code>`, so the plugin's GLOBAL markdown
 * post-processor never runs and the walker always meets the `<code>` branch, which resolves correctly. In the app it is
 * the post-processor that meets the `<code>` first and replaces it with a CONTEXT-FREE `.archivist-tag` widget; the
 * walker then has to upgrade THAT, and for a non-rollable tag (`dc`, `check`) the widget carried no data attribute and
 * its rendered text ("DC INT") does not parse back into a tag, so the walker returned early and the context-free widget
 * stayed on the page.
 *
 * So this test runs the REAL route: `renderMonsterBlock` -> `renderFeatureBlock` -> `renderMarkdownDescription` (the
 * DEFAULT render, not an injected one) -> Obsidian's `MarkdownRenderer.render`, stood in for by a mock that emits what
 * the app emits (a `<p>` with one `<code>` per backticked tag) and THEN runs the plugin's own registered post-processor
 * body, `replaceInlineTagCodes`, which `main.ts` registers verbatim (pinned below) -> the widget walker.
 */

beforeAll(() => installObsidianDomHelpers());

/** INT 20 is +5 and CR 12 is a proficiency bonus of +4, so `dc:INT` resolves to 8 + 4 + 5 = 17 (the SRD 2024 Archmage). */
const ABIL = { str: 10, dex: 14, con: 12, int: 20, wis: 15, cha: 16 };

function archmageLike(entry: string): Monster {
  return { name: "Archmage", abilities: ABIL, cr: "12", actions: [{ name: "Spell", entries: [entry] }] } as unknown as Monster;
}

/** The app's pipeline: Obsidian renders the markdown, then runs every registered post-processor over what it made. */
function mockObsidianWithPostProcessor(): { mockRestore: () => void } {
  return vi.spyOn(MarkdownRenderer, "render").mockImplementation((async (_app: unknown, source: string, target: HTMLElement) => {
    const doc = target.ownerDocument;
    const p = doc.createElement("p");
    for (const part of source.split(/(`[^`]+`)/)) {
      if (part.length === 0) continue;
      if (part.startsWith("`") && part.endsWith("`")) {
        const code = doc.createElement("code");
        code.textContent = part.slice(1, -1);
        p.appendChild(code);
      } else {
        p.appendChild(doc.createTextNode(part));
      }
    }
    target.appendChild(p);
    replaceInlineTagCodes(p);
  }) as unknown as typeof MarkdownRenderer.render);
}

describe("B026-D11 · an ability-keyed tag through the REAL global post-processor", () => {
  it("resolves `dc:INT` to the monster's number and leaves no context-free widget behind", async () => {
    const spy = mockObsidianWithPostProcessor();
    try {
      const { el, ready } = renderMonsterBlock(archmageLike("The archmage casts a spell (spell save `dc:INT`)."), 1);
      await ready;

      const dc = el.querySelector(".archivist-stat-tag-dc");
      expect(dc?.textContent).toBe("DC 17");
      expect(el.querySelectorAll(".archivist-tag").length).toBe(0);
      expect(el.textContent ?? "").not.toMatch(/DC (STR|DEX|CON|INT|WIS|CHA)\b/);
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * `check:` is the OTHER non-rollable tag, and it is upgraded by the same route; what it prints is a MEASURED limit of
   * the engine, not of this walker: `normalizeTagType` (dnd5e `dnd/tag-grammar.ts:17-24`) knows `atk` / `dmg` / `dc` /
   * `dice` only, so `resolveTagContent` passes a `check:` content through untouched on BOTH the pre-G7 route and this
   * one. Measured over the shipped corpora: 0 `check:<ability>` carriers (the `.compendium-bundle` and the 4,996
   * converter monster notes carry none; the 61 "check:" hits in the converter output are prose). So this pins that the
   * widget is upgraded to the stat-block one and that the rollable tags beside it still resolve.
   */
  it("`check:DEX` is upgraded to the stat-block widget (its content is unresolvable by the engine's own vocabulary)", async () => {
    const spy = mockObsidianWithPostProcessor();
    try {
      const m = archmageLike("Melee Attack Roll: `atk:INT+PB`, one target. Hit: `d:2d10` psychic damage, escape `check:DEX`.");
      const { el, ready } = renderMonsterBlock(m, 1);
      await ready;

      const entry = el.querySelector(".archivist-feature-entry") as HTMLElement;
      expect(entry.querySelectorAll(".archivist-tag").length).toBe(0);
      expect(entry.querySelector(".archivist-stat-tag-atk")?.textContent).toBe("+9 to hit");
      expect(entry.querySelector(".archivist-stat-tag-dice")?.textContent).toBe("2d10");
      expect(entry.querySelectorAll(".archivist-stat-tag-dc").length).toBe(1);
      expect(entry.textContent ?? "").toMatch(/escape DEX\./);
    } finally {
      spy.mockRestore();
    }
  });

  it("a LITERAL `dc:16` still prints 16 through the same route (the tag that was right by accident)", async () => {
    const spy = mockObsidianWithPostProcessor();
    try {
      const { el, ready } = renderMonsterBlock(archmageLike("Constitution Saving Throw: `dc:16`."), 1);
      await ready;

      expect(el.querySelector(".archivist-stat-tag-dc")?.textContent).toBe("DC 16");
      expect(el.querySelectorAll(".archivist-tag").length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  /** A characterisation pin: the function this file runs is the one the plugin registers, not a copy of its body. */
  it("PIN: main.ts registers exactly this post-processor body", () => {
    const main = readFileSync(path.resolve(__dirname, "../packages/obsidian/src/main.ts"), "utf8");
    expect(main).toContain("this.registerMarkdownPostProcessor((element) => replaceInlineTagCodes(element));");
    expect(main).toContain('import { replaceInlineTagCodes } from "./shared/rendering/inline-tag-renderer";');
  });
});
