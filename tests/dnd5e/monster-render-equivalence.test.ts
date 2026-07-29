/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseContainer } from "@archivist-gg/core";
import { monsterCodec, parseMonster } from "@archivist-gg/dnd5e";
import type { Monster } from "@archivist-gg/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "../../packages/obsidian/src/modules/monster/monster.renderer";
import { installObsidianDomHelpers } from "../fixtures/pc/dom-helpers";

beforeAll(() => installObsidianDomHelpers());

function monsterFiles(edition: string): string[] {
  const dir = path.resolve(__dirname, "../../.compendium-bundle", edition, "Monsters");
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
}

/** First index where two strings differ, or -1 if identical. */
function firstDiff(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

/**
 * Task 12 render-path safety net.
 *
 * Before this task the monster code-block processor parsed via the legacy
 * adapter (`mod.parseYaml` = `parseMonster`), handing the renderer a
 * normalized `Monster`. After registering `dnd5ePack`, the processor parses
 * monster via `monsterEntityType.doc` = `monsterCodec` (raw `yaml.load`).
 *
 * The markdown processor's render path is not otherwise unit-tested, so this
 * test proves — over the FULL shipped SRD monster corpus — that switching the
 * parse source from `parseMonster` to `monsterCodec` does not change a single
 * rendered monster: `renderMonsterBlock(parseMonster(body))` and
 * `renderMonsterBlock(monsterCodec.parse(body))` produce byte-identical
 * `outerHTML`.
 */
describe.each(["SRD 5e", "SRD 2024"])("monster render equivalence (%s)", (edition) => {
  it("renders identical HTML for the entire monster corpus", () => {
    const files = monsterFiles(edition);
    // Guard against a vacuous pass if the corpus dir were absent/empty.
    // Measured 2026-07-28: SRD 5e = 325, SRD 2024 = 331.
    expect(files.length).toBeGreaterThan(300);

    const failures: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const doc = parseContainer(text);
      if (!doc.success) { failures.push(`${path.basename(file)}: container parse failed`); continue; }

      const viaParser = parseMonster(doc.data.body);
      if (!viaParser.success) { failures.push(`${path.basename(file)}: parseMonster failed: ${viaParser.error}`); continue; }

      const viaCodec = monsterCodec.parse(doc.data);
      if (!viaCodec.success) { failures.push(`${path.basename(file)}: codec parse failed: ${viaCodec.error}`); continue; }

      const htmlParser = renderMonsterBlock(viaParser.data).outerHTML;
      const htmlCodec = renderMonsterBlock(viaCodec.data as unknown as Monster).outerHTML;

      if (htmlParser !== htmlCodec) {
        const at = firstDiff(htmlParser, htmlCodec);
        const window = 80;
        const from = Math.max(0, at - window);
        failures.push(
          `${path.basename(file)}: render diverged at char ${at}\n` +
          `  parser: ...${htmlParser.slice(from, at + window)}...\n` +
          `  codec:  ...${htmlCodec.slice(from, at + window)}...`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
