import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INDEX = join(__dirname, "..", ".compendium-bundle", "index.json");

/** §6.2's coupling tripwire. The design's "a fresh draft's first render never
 *  swallows an unconditional gold grant" argument rests on there being no such
 *  grant reachable in the shipped data. If that changes, the adopt rule needs a
 *  real draft-vs-reopened discriminator, and this census must be the thing that
 *  says so.
 *
 *  Reads `index.json` · the ONE tracked path under `.compendium-bundle/`
 *  (`.gitignore` excludes every subdirectory of it, so the loose markdown tree
 *  is regenerated, not committed). Same precedent and same guard shape as
 *  `tests/srd-canonical/bundle-magic-initiate-spells.test.ts`. */
const present = existsSync(INDEX);
const entries: Array<[string, string]> = present
  ? Object.entries(JSON.parse(readFileSync(INDEX, "utf8")) as Record<string, string>)
  : [];

describe.skipIf(!present)("shipped-data census (R4-P5b G17)", () => {
  it("the census reads a non-trivial number of bundle entries (positive control)", () => {
    expect(entries.length).toBeGreaterThan(3000);
  });

  it("no entry uses `kind: gold`", () => {
    const hits = entries.filter(([, text]) => /^\s*-?\s*kind:\s*gold\s*$/m.test(text)).map(([p]) => p);
    expect(hits).toEqual([]);
  });

  it("no CLASS carries a gold grant in an unconditional `kind: fixed` entry", () => {
    // A `- gold:` at 6-space indent sits directly under a `kind: fixed` grants
    // list; the 33 legitimate ones are nested inside `options:` at 10 spaces.
    // The single 6-space instance repo-wide is the SRD-5e Acolyte BACKGROUND,
    // which this filter excludes: it keeps only `/Classes/` paths. R4-G3b Task 10
    // made the background limb live, so that grant is reachable now; on a FRESH
    // bag `goldStep` rule 1 adopts it instead of depositing it, which R4-G3b §9.4
    // states and deliberately does not assert.
    const offenders = entries
      .filter(([p, text]) => /[/\\]Classes[/\\]/.test(p) && /^ {6}- gold:/m.test(text))
      .map(([p]) => p);
    expect(offenders).toEqual([]);
  });
});
