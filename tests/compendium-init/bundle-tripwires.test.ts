import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as yaml from "js-yaml";
import { parseCompendiumVersion } from "../../packages/obsidian/src/shared/compendium-init/compendium-version";
import { splitBundleByCompendium } from "../../packages/obsidian/src/shared/compendium-init/embedded-bundle";
import {
  BUNDLE_NOTE_FRONTMATTER_KEYS, isPristineBundleNote, keepKey,
} from "../../packages/obsidian/src/shared/compendium-init/prune";
import { generateEntityMarkdown } from "../../packages/obsidian/src/shared/entities/entity-vault-store";

// The tracked artifact the plugin embeds. The loose SRD 5e/ and SRD 2024/ trees beside it are gitignored output.
const bundle = JSON.parse(readFileSync(resolve(__dirname, "../../.compendium-bundle/index.json"), "utf8")) as Record<string, string>;
const FM = /^---\n([\s\S]*?)\n---/;
const fmKeys = (c: string): string[] => Object.keys((yaml.load(FM.exec(c)![1]) as Record<string, unknown>) ?? {});
const entityEntries = Object.entries(bundle).filter(([p]) => !p.endsWith("/_compendium.md"));
const indexEntries = Object.entries(bundle).filter(([p]) => p.endsWith("/_compendium.md"));

describe("G16 · the shipped bundle", () => {
  it("has 3,331 paths = 3,329 entity notes + 2 index files, one index per top-level compendium, 1,521 + 1,808 entity notes", () => {
    expect(Object.keys(bundle).length).toBe(3331);
    expect(entityEntries.length).toBe(3329);
    expect(indexEntries.map(([p]) => p).sort()).toEqual(["SRD 2024/_compendium.md", "SRD 5e/_compendium.md"]);
    expect([...splitBundleByCompendium(bundle).keys()].sort()).toEqual(["SRD 2024", "SRD 5e"]);
    // The fresh path relies on entity keys to create each compendium folder (spec §5.3/§8):
    // a note-less sub-bundle would write its index into a folder nothing created.
    expect(entityEntries.filter(([p]) => p.startsWith("SRD 5e/")).length).toBe(1521);
    expect(entityEntries.filter(([p]) => p.startsWith("SRD 2024/")).length).toBe(1808);
  });
  it("every index stamp parses as a string and all stamps agree", () => {
    const stamps = indexEntries.map(([, c]) => parseCompendiumVersion(c));
    for (const s of stamps) expect(typeof s).toBe("string");
    expect(new Set(stamps).size).toBe(1);
  });
  it("the baked index key set is exactly the seven recorded in spec §1 (a generator emitting hidden or readonly differently reddens this)", () => {
    for (const [, c] of indexEntries) {
      expect(fmKeys(c)).toEqual([
        "archivist_compendium", "name", "description", "edition", "readonly", "homebrew", "archivist_compendium_version",
      ]);
    }
  });
  it("the entity-note key union EQUALS the six bundle keys, both directions", () => {
    const union = new Set<string>();
    let allHaveAll = true;
    for (const [, c] of entityEntries) {
      const keys = fmKeys(c);
      for (const k of keys) union.add(k);
      for (const k of BUNDLE_NOTE_FRONTMATTER_KEYS) if (!keys.includes(k)) allHaveAll = false;
    }
    expect([...union].sort()).toEqual([...BUNDLE_NOTE_FRONTMATTER_KEYS].sort());
    expect(allHaveAll).toBe(true);
  });
  it("isPristineBundleNote is true for all 3,329 shipped notes (the not-over-protective control) and false for generateEntityMarkdown output", () => {
    let pristine = 0;
    for (const [, c] of entityEntries) if (isPristineBundleNote(c)) pristine++;
    expect(pristine).toBe(3329);
    expect(isPristineBundleNote(generateEntityMarkdown({
      entityType: "background", slug: "srd-5e_background_x", name: "X", compendium: "SRD 5e", data: { slug: "srd-5e_background_x" },
    }))).toBe(false);
  });
  it("no two bundle keys collide under keepKey (the case-insensitive keep set cannot merge two shipped notes)", () => {
    const seen = new Set<string>();
    for (const p of Object.keys(bundle)) {
      const k = keepKey(`Compendium/${p}`);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
  it("0 non-ASCII bundle keys (no source symbol reaches this clause, so no code mutant can redden it; its control is the isolating non-ASCII rename of one key in the tracked index.json)", () => {
    for (const p of Object.keys(bundle)) expect(/^[\x20-\x7e]+$/.test(p)).toBe(true);
  });
});
