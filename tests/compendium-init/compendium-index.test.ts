import { describe, it, expect } from "vitest";
import {
  USER_OWNED_INDEX_KEYS,
  indexUpdates,
  mergeCompendiumIndex,
  writeCompendiumIndex,
} from "../../packages/obsidian/src/shared/compendium-init/compendium-index";
import { makeHarness } from "./harness";

// The BAKED side carries readonly:true and hidden:false so that the "minus hidden" half of
// the split can fail; the shipped bundle has no hidden key today (spec §5.3, future-proofing).
const BAKED = [
  "---",
  "archivist_compendium: true",
  "name: SRD 5e",
  "description: D&D 5e System Reference Document 5.1 (new)",
  "edition: '2014'",
  "readonly: true",
  "hidden: false",
  "homebrew: false",
  "archivist_compendium_version: 0.9.9",
  "---",
  "",
  "# SRD 5e",
  "",
].join("\n");

const EXISTING = [
  "---",
  "archivist_compendium: true",
  "name: SRD 5e",
  "description: D&D 5e System Reference Document 5.1",
  "edition: '2014'",
  "readonly: false",
  "hidden: true",
  "homebrew: false",
  "archivist_compendium_version: 0.3.2",
  "archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'",
  "---",
  "",
  "# SRD 5e",
  "",
  "A user note under the index.",
  "",
].join("\n");

describe("indexUpdates", () => {
  it("leaves a DECLARED (boolean) readonly and hidden alone: every other baked key is written", () => {
    expect(USER_OWNED_INDEX_KEYS).toEqual(["readonly", "hidden"]);
    expect(Object.keys(indexUpdates(EXISTING, BAKED))).toEqual([
      "archivist_compendium", "name", "description", "edition", "homebrew", "archivist_compendium_version",
    ]);
  });
  it("restores readonly when the existing file LACKS it, and never writes hidden (absence is the reconcile's state)", () => {
    const noToggles = EXISTING.replace("readonly: false\n", "").replace("hidden: true\n", "");
    expect(Object.keys(indexUpdates(noToggles, BAKED))).toEqual([
      "archivist_compendium", "name", "description", "edition", "readonly", "homebrew", "archivist_compendium_version",
    ]);
    expect(indexUpdates(noToggles, BAKED).readonly).toBe(true);
  });
  it("treats a non-boolean readonly (a hand-edited string) as undeclared and restores it", () => {
    const stringy = EXISTING.replace("readonly: false\n", "readonly: 'false'\n");
    expect(indexUpdates(stringy, BAKED).readonly).toBe(true);
  });
});

describe("mergeCompendiumIndex (G5, G6 pure halves)", () => {
  it("G5: updates the bundle-owned keys, preserves readonly:false, hidden:true, the legacy key, key order and the body", () => {
    const out = mergeCompendiumIndex(EXISTING, BAKED);
    expect(out).toBe([
      "---",
      "archivist_compendium: true",
      "name: SRD 5e",
      "description: D&D 5e System Reference Document 5.1 (new)",
      "edition: '2014'",
      "readonly: false",
      "hidden: true",
      "homebrew: false",
      "archivist_compendium_version: 0.9.9",
      "archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'",
      "---",
      "",
      "# SRD 5e",
      "",
      "A user note under the index.",
      "",
    ].join("\n"));
  });
  it("G5c (i): an ABSENT readonly is restored from the bundle (a hand-removed readonly must not make the SRD writable); an absent hidden stays absent", () => {
    const noToggles = EXISTING.replace("readonly: false\n", "").replace("hidden: true\n", "");
    const out = mergeCompendiumIndex(noToggles, BAKED);
    expect(out).toContain("readonly: true");
    expect(out).not.toContain("hidden:");
    expect(out).toContain("archivist_compendium_version: 0.9.9");
    expect(out).toContain("A user note under the index.");
  });
  it("G5c (ii): the restored VALUE comes from the bundle, not a hardcoded true", () => {
    // The shipped bundle has only ever carried readonly: true, so this arm is what tells a
    // restore from a constant (practice rule 7: fixture monoculture).
    const noReadonly = EXISTING.replace("readonly: false\n", "");
    const bakedWritable = BAKED.replace("readonly: true\n", "readonly: false\n");
    const out = mergeCompendiumIndex(noReadonly, bakedWritable);
    expect(out).toContain("readonly: false");
    expect(out).toContain("hidden: true");   // the declared hidden survives
  });
  it("G5c (iii): a hand-edited readonly STRING counts as undeclared and is restored to the baked boolean", () => {
    const stringy = EXISTING.replace("readonly: false\n", "readonly: 'false'\n");
    const out = mergeCompendiumIndex(stringy, BAKED);
    expect(out).toContain("readonly: true");
    expect(out).not.toContain("readonly: 'false'");
  });
  it("G6: with nothing existing, the baked bytes verbatim", () => {
    expect(mergeCompendiumIndex(null, BAKED)).toBe(BAKED);
  });
  it("G3b half: an existing file with no parseable frontmatter is replaced by the baked bytes", () => {
    expect(mergeCompendiumIndex("# bare\n", BAKED)).toBe(BAKED);
  });
  it("control: the merge is byte-stable when the baked file equals the existing file (the R3-P7 writer round-trip)", () => {
    const same = BAKED.replace("0.9.9", "0.3.2").replace(" (new)", "");
    expect(mergeCompendiumIndex(same, same)).toBe(same);
  });
});

describe("writeCompendiumIndex (G5b, G6 write halves)", () => {
  const P = "Compendium/SRD 5e/_compendium.md";
  it("G6: verbatim mode writes the baked bytes through the adapter", async () => {
    const h = makeHarness({});
    expect(await writeCompendiumIndex(h.vault, P, BAKED, "verbatim")).toBe("adapter");
    expect(h.files.get(P)).toBe(BAKED);
    expect(h.log).toEqual([{ kind: "write", path: P }]);
  });
  it("G5b (i): merge mode goes through vault.process on the indexed TFile, so cachedRead sees the new stamp in the same load", async () => {
    const h = makeHarness({ [P]: EXISTING });
    expect(await writeCompendiumIndex(h.vault, P, BAKED, "merge")).toBe("process");
    expect(h.log).toEqual([{ kind: "process", path: P }]);
    expect(await h.vault.cachedRead(h.fileOf(P)!)).toContain("archivist_compendium_version: 0.9.9");
    expect(await h.vault.cachedRead(h.fileOf(P)!)).toContain("readonly: false");
  });
  it("G5b (ii): merge mode with the file on disk but absent from the index falls back to the adapter and still merges", async () => {
    const h = makeHarness({});
    await h.vault.adapter.write(P, EXISTING);      // no reindex(): the TFile does not exist yet
    h.log.length = 0;
    expect(await writeCompendiumIndex(h.vault, P, BAKED, "merge")).toBe("adapter");
    expect(h.log).toEqual([{ kind: "write", path: P }]);
    expect(h.files.get(P)).toContain("archivist_compendium_version: 0.9.9");
    expect(h.files.get(P)).toContain("readonly: false");
  });
});
