import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseContainer } from "@archivist/core";
import { monsterCodec } from "@archivist/dnd5e";

const dirs = ["SRD 5e/Monsters", "SRD 2024/Monsters"].map((d) =>
  path.resolve(__dirname, "../../.compendium-bundle", d));

function monsterFiles(): string[] {
  return dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => path.join(d, f)));
}

describe("monster codec round-trip (semantic losslessness)", () => {
  it("loses no keys/values across the entire SRD monster corpus", () => {
    // Guard against a vacuous pass: if the corpus dirs were ever absent/empty,
    // the failures-array assertion below would trivially hold with zero data.
    expect(monsterFiles().length).toBeGreaterThan(500);

    const failures: string[] = [];
    for (const file of monsterFiles()) {
      const text = readFileSync(file, "utf8");
      const doc = parseContainer(text);
      if (!doc.success) { failures.push(`${file}: container parse failed`); continue; }
      const parsed = monsterCodec.parse(doc.data);
      if (!parsed.success) { failures.push(`${file}: codec parse failed: ${parsed.error}`); continue; }
      const reparsed = yaml.load(monsterCodec.serialize(parsed.data));
      const original = yaml.load(doc.data.body);
      if (JSON.stringify(reparsed) !== JSON.stringify(original)) failures.push(`${file}: round-trip diff`);
    }
    expect(failures).toEqual([]);
  });
});
