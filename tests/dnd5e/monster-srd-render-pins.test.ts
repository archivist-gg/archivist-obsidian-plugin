/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createArchivist, parseContainer } from "@archivist-gg/core";
import type { StoragePort } from "@archivist-gg/core";
import { dnd5ePack } from "@archivist-gg/dnd5e";
import type { FormulaContext } from "@archivist-gg/dnd5e";
import type { App, Component } from "obsidian";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../../packages/obsidian/src/modules/monster/monster.renderer";
import { renderMarkdownDescription } from "../../packages/obsidian/src/shared/rendering/markdown-description";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers";

/**
 * The SRD monster RENDER PINS (R4-G6 spec §12.3). One sha per file per column mode over the outerHTML of
 * `renderMonsterBlock(resolved, columns, undefined, { render })`, where `resolved` is the kernel's `resolve` output
 * exactly as `main.ts` renders it (NOT the codec output: the two agree today only because the renderer recomputes PB
 * itself). Since Q-11 (R4-G7 spec §7.6) the block's markdown fills are asynchronous and the measurement awaits
 * `ready`; the injected `render` is what makes the pinned HTML reproducible, because the jsdom obsidian mock renders
 * markdown as bare `textContent` and the widget walker would then find no `<code>` to swap.
 * `G6_WRITE_PINS=1` re-writes the tracked pin file, which has been taken THREE times: T0 took it, T7a
 * re-took it once the one-line Challenge delta was reported, and the Task 10 fix wave re-took it again when the
 * decimal-CR XP lookup moved 162 of the 656 files on that same Challenge line; the shas in `PINS` are still those
 * post-Task-10 ones, so this file is RED from R4-G7 T4's commit until T5 re-takes it once (spec §14.2, the ONE
 * sanctioned exception window). Otherwise every file's two shas must equal them byte for byte.
 * Replaces `monster-render-equivalence.test.ts`, which compared two calls of one function.
 */
const PINS = path.resolve(__dirname, "../fixtures/g6-srd-render-pins.json");
const EDITIONS = ["SRD 5e", "SRD 2024"];

function memStorage(): StoragePort {
  return { listFolder: async () => [], read: async () => "", write: async () => {}, ensureFolder: async () => {}, exists: async () => false };
}

function sha(s: string): string { return createHash("sha256").update(s).digest("hex"); }

/**
 * The markdown stand-in the pins are measured through: it writes the markdown as text and wraps each backticked tag
 * in a `<code>` element, which is what real Obsidian emits and what `renderMarkdownDescription`'s walker replaces
 * with a widget. The jsdom mock's own `MarkdownRenderer.render` sets bare `textContent`, so without this the pinned
 * HTML would carry no widget at all for the 1,218 `atk:` / `dc:` tags of the corpus.
 */
async function codeEmittingRender(parent: HTMLElement, markdown: string, _app?: App, _component?: Component, monsterCtx?: FormulaContext): Promise<void> {
  const doc = parent.ownerDocument;
  for (const part of markdown.split(/(`[^`]+`)/)) {
    if (part.length === 0) continue;
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = doc.createElement("code");
      code.textContent = part.slice(1, -1);
      parent.appendChild(code);
    } else {
      parent.appendChild(doc.createTextNode(part));
    }
  }
  // The walker pass only (the <code> above is already staged), with the monster's own context, so the pinned HTML
  // carries the RESOLVED widget exactly as the live route builds it.
  await renderMarkdownDescription(parent, "", undefined, undefined, monsterCtx);
}

async function renderedHtml(m: Monster, columns: number): Promise<string> {
  const { el, ready } = renderMonsterBlock(m, columns, undefined, { render: codeEmittingRender });
  await ready;
  return el.outerHTML;
}

beforeAll(() => installObsidianDomHelpers());

describe("SRD monster render pins (R4-G6 §12.3)", () => {
  it("renders every SRD monster in both column modes to the pinned shas", async () => {
    const archivist = createArchivist({ storage: memStorage(), content: { lookup: () => undefined } });
    archivist.registerPack(dnd5ePack);
    const files: string[] = [];
    for (const ed of EDITIONS) {
      const dir = path.resolve(__dirname, "../../.compendium-bundle", ed, "Monsters");
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".md"))) files.push(`${ed}/Monsters/${f}`);
    }
    expect(files.length).toBe(656); // vacuity guard: 325 SRD 5e + 331 SRD 2024

    const measured: Record<string, { c1: string; c2: string }> = {};
    const failures: string[] = [];
    for (const rel of files) {
      const text = readFileSync(path.resolve(__dirname, "../../.compendium-bundle", rel), "utf8");
      const doc = parseContainer(text);
      if (!doc.success) { failures.push(`${rel}: container parse failed`); continue; }
      const resolved = archivist.resolve(doc.data);
      if (!resolved.success) { failures.push(`${rel}: resolve failed`); continue; }
      const m = resolved.data as Monster;
      measured[rel] = { c1: sha(await renderedHtml(m, 1)), c2: sha(await renderedHtml(m, 2)) };
    }
    expect(failures).toEqual([]);

    if (process.env.G6_WRITE_PINS === "1") {
      writeFileSync(PINS, JSON.stringify(measured, null, 1) + "\n");
      return;
    }
    const pinned = JSON.parse(readFileSync(PINS, "utf8")) as Record<string, { c1: string; c2: string }>;
    expect(Object.keys(pinned).length).toBe(656);
    const moved = files.filter((rel) => pinned[rel]?.c1 !== measured[rel].c1 || pinned[rel]?.c2 !== measured[rel].c2);
    expect(moved).toEqual([]);
  });
});
