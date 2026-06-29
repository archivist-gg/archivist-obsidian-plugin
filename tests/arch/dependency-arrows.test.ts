import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";
import { writeFileSync, rmSync } from "node:fs";

// Real file inside packages/core/src so the project-aware flat config parses it
// (lintText with a fake filePath fatals under parserOptions.project → rule never runs).
const probe = "packages/core/src/__arrow_probe__.ts";

describe("dependency-arrow enforcement", () => {
  it("flags a core→dnd5e import via import/no-restricted-paths", async () => {
    writeFileSync(probe, `import { dnd5ePack } from "@archivist/dnd5e";\nexport const x = dnd5ePack;\n`);
    try {
      const [result] = await new ESLint({}).lintFiles([probe]);
      expect(result.messages.map((m) => m.ruleId)).toContain("import/no-restricted-paths");
    } finally {
      rmSync(probe, { force: true });
    }
  });
});
