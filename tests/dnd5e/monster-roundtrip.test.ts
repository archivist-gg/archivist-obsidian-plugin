import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseContainer } from "@archivist/core";
import { monsterCodec } from "@archivist/dnd5e";

const dirs = ["SRD 5e/Monsters", "SRD 2024/Monsters"].map((d) =>
  path.resolve(__dirname, "../../.compendium-bundle", d));

function monsterFiles(): string[] {
  return dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => path.join(d, f)));
}

/**
 * Normalized-idempotence contract (0c.1a B8).
 *
 * `monsterCodec` is now a NORMALIZING codec (it delegates `parse` to `parseMonster`),
 * not a raw passthrough. By design it drops unmodeled top-level keys (`slug`/`edition`/
 * `source`) and emits the canonical `Monster` field order, so raw-passthrough semantic
 * losslessness vs the original SRD body no longer holds — and is no longer the contract.
 * The correct contract for a normalizing codec is idempotence: re-parsing the codec's own
 * serialized output yields the same normalized `Monster`, i.e. `parse → serialize → parse`
 * deep-equals `parse`. (Production monster SAVE goes through obsidian's `editableToYaml`,
 * NOT `monsterCodec.serialize`, so this contract change introduces no production data-loss path.)
 */
describe("monster codec normalized idempotence (parse→serialize→parse == parse)", () => {
  it("round-trips the normalized Monster across the entire SRD monster corpus", () => {
    // Guard against a vacuous pass: if the corpus dirs were ever absent/empty,
    // the failures-array assertion below would trivially hold with zero data.
    expect(monsterFiles().length).toBeGreaterThan(500);

    const failures: string[] = [];
    for (const file of monsterFiles()) {
      const text = readFileSync(file, "utf8");
      const doc = parseContainer(text);
      if (!doc.success) { failures.push(`${file}: container parse failed`); continue; }
      const first = monsterCodec.parse(doc.data);
      if (!first.success) { failures.push(`${file}: codec parse failed: ${first.error}`); continue; }
      const round = monsterCodec.parse({ ...doc.data, body: monsterCodec.serialize(first.data) });
      if (!round.success) { failures.push(`${file}: codec re-parse failed: ${round.error}`); continue; }
      try {
        expect(round.data).toEqual(first.data);
      } catch {
        failures.push(`${file}: round-trip diff`);
      }
    }
    expect(failures).toEqual([]);
  });
});
