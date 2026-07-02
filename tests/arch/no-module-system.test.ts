import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// 0f pin: the strangler module system is GONE. The three bridge files must
// not exist and no source file may reference their import paths. Mirrors the
// source-scan idiom of the dependency-arrow gate (tests/arch).

const DELETED = [
  "packages/obsidian/src/core/module-api.ts",
  "packages/obsidian/src/core/module-registry.ts",
  "packages/obsidian/src/adapter/presentation-registry.ts",
];

const SRC_ROOTS = [
  "packages/core/src",
  "packages/dnd5e/src",
  "packages/obsidian/src",
];

const BANNED = [/core\/module-api/i, /core\/module-registry/i, /adapter\/presentation-registry/i];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("no-module-system pin (0f)", () => {
  it("the three bridge files are deleted", () => {
    for (const f of DELETED) {
      expect(existsSync(f), `${f} must not exist`).toBe(false);
    }
  });

  it("no source file references the deleted bridge paths", () => {
    for (const root of SRC_ROOTS) {
      for (const f of walk(root)) {
        const src = readFileSync(f, "utf8");
        for (const re of BANNED) {
          expect(re.test(src), `${f} references ${re}`).toBe(false);
        }
      }
    }
  });
});
