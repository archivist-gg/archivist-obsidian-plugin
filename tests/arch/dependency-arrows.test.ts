import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";
import { writeFileSync, rmSync } from "node:fs";

// Real file inside packages/dnd5e/src so the project-aware flat config parses it
// (lintText with a fake filePath fatals under parserOptions.project → rule never runs).
// Probes the surviving arrow: dnd5e may import only @archivist/core, not obsidian.
const probe = "packages/dnd5e/src/__arrow_probe__.ts";

describe("dependency-arrow enforcement", () => {
  it("flags a dnd5e→obsidian import via import/no-restricted-paths", async () => {
    writeFileSync(probe, `import "../../obsidian/src/main";\nexport const x = 1;\n`);
    try {
      const [result] = await new ESLint({}).lintFiles([probe]);
      expect(result.messages.map((m) => m.ruleId)).toContain("import/no-restricted-paths");
    } finally {
      rmSync(probe, { force: true });
    }
  });
});
