/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createArchivist, parseContainer } from "@archivist-gg/core";
import type { StoragePort } from "@archivist-gg/core";
import { dnd5ePack } from "@archivist-gg/dnd5e";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../../packages/obsidian/src/modules/monster/monster.renderer";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers";

/**
 * The SRD monster RENDER PINS (R4-G6 spec §12.3). One sha per file per column mode over the outerHTML of
 * `renderMonsterBlock(resolved, columns)`, where `resolved` is the kernel's `resolve` output exactly as
 * `main.ts` renders it (NOT the codec output: the two agree today only because the renderer recomputes PB
 * itself). `G6_WRITE_PINS=1` re-writes the tracked pin file (T0 writes it; T7a re-writes it after the one-line
 * Challenge delta is reported); otherwise every file's two shas must equal the pins byte for byte.
 * Replaces `monster-render-equivalence.test.ts`, which compared two calls of one function.
 */
const PINS = path.resolve(__dirname, "../fixtures/g6-srd-render-pins.json");
const EDITIONS = ["SRD 5e", "SRD 2024"];

function memStorage(): StoragePort {
  return { listFolder: async () => [], read: async () => "", write: async () => {}, ensureFolder: async () => {}, exists: async () => false };
}

function sha(s: string): string { return createHash("sha256").update(s).digest("hex"); }

beforeAll(() => installObsidianDomHelpers());

describe("SRD monster render pins (R4-G6 §12.3)", () => {
  it("renders every SRD monster in both column modes to the pinned shas", () => {
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
      measured[rel] = { c1: sha(renderMonsterBlock(m, 1).outerHTML), c2: sha(renderMonsterBlock(m, 2).outerHTML) };
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
