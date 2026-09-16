import { describe, it, expect } from "vitest";
import { TFolder } from "obsidian";
import {
  BUNDLE_NOTE_FRONTMATTER_KEYS,
  LEGACY_BUNDLE_NOTE_KEYS,
  keepKey,
  isPristineBundleNote,
  collectPruneCandidates,
  pruneOrphans,
} from "../../packages/obsidian/src/shared/compendium-init/prune";
import { generateEntityMarkdown } from "../../packages/obsidian/src/shared/entities/entity-vault-store";
import { makeHarness } from "./harness";

const six = (slug: string, extra = "", body = "") =>
  `---\narchivist: true\nentity_type: background\nslug: ${slug}\nname: ${slug}\ncompendium: SRD 5e\nsource: SRD 5.1\n${extra}---\n\n\`\`\`background\nslug: ${slug}\n\`\`\`\n${body}`;
const fiveKey = generateEntityMarkdown({
  entityType: "background", slug: "srd-5e_background_mine", name: "Mine", compendium: "SRD 5e", data: { slug: "srd-5e_background_mine" },
});
const ROOT = "Compendium";
const bundle = {
  "SRD 5e/_compendium.md": "---\narchivist_compendium: true\narchivist_compendium_version: 1.0.0\n---\n",
  "SRD 5e/Backgrounds/Acolyte.md": six("srd-5e_background_acolyte"),
  "SRD 5e/Backgrounds/Sage.md": six("srd-5e_background_sage"),
  "SRD 5e/Races/Dwarf.md": six("srd-5e_race_dwarf"),
};
// Entity keys only: the index entry is deliberately NOT in the keep set (spec §5.5), so the name
// exclusion is the only thing protecting `_compendium.md` and G11's clause can fail.
const keepOf = (b: Record<string, string>) =>
  new Set(Object.keys(b).filter((k) => !k.endsWith("/_compendium.md")).map((k) => keepKey(`${ROOT}/${k}`)));
const vaultOf = (b: Record<string, string>, extra: Record<string, string>) => {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) files[`${ROOT}/${k}`] = v;
  return makeHarness({ ...files, ...extra });
};

describe("isPristineBundleNote", () => {
  it("true for the six-key fence-only shape and for the seven-key legacy shape", () => {
    expect(isPristineBundleNote(six("a"))).toBe(true);
    expect(isPristineBundleNote(six("a", "archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'\n"))).toBe(true);
    expect(BUNDLE_NOTE_FRONTMATTER_KEYS).toEqual(["archivist", "entity_type", "slug", "name", "compendium", "source"]);
    expect(LEGACY_BUNDLE_NOTE_KEYS).toEqual(["archivist_compendium_imported_at"]);
  });
  it("G9: false for generateEntityMarkdown output (five keys, no source)", () => {
    expect(isPristineBundleNote(fiveKey)).toBe(false);
  });
  it("G9b: false for six keys plus any OTHER extra key", () => {
    expect(isPristineBundleNote(six("a", "rating: 5\n"))).toBe(false);
  });
  it("G10: false for prose outside the fence; false for no frontmatter", () => {
    expect(isPristineBundleNote(six("a", "", "\nMy notes.\n"))).toBe(false);
    expect(isPristineBundleNote("# bare")).toBe(false);
  });
});

describe("keepKey", () => {
  it("lower-cases, and does nothing else", () => {
    expect(keepKey("Compendium/SRD 5e/Backgrounds/Acolyte.md")).toBe("compendium/srd 5e/backgrounds/acolyte.md");
  });
});

describe("collectPruneCandidates (G8b, G11)", () => {
  it("G8b: an indexed path whose CASE differs from the bundle key is never a candidate", () => {
    const h = vaultOf({}, { [`${ROOT}/SRD 5e/Backgrounds/ACOLYTE.md`]: six("x") });
    const keep = keepOf({ "SRD 5e/Backgrounds/Acolyte.md": "" });
    const folder = h.vault.getAbstractFileByPath(`${ROOT}/SRD 5e`) as TFolder;
    expect(collectPruneCandidates(folder, keep)).toEqual([]);
  });
  it("G11 (own index): the compendium's own _compendium.md is never a candidate even though it is not in the keep set", () => {
    const h = vaultOf(bundle, {});
    const folder = h.vault.getAbstractFileByPath(`${ROOT}/SRD 5e`) as TFolder;
    expect(collectPruneCandidates(folder, keepOf(bundle))).toEqual([]);
  });
  it("G11: _compendium.md is never a candidate, a nested folder holding one is skipped whole, non-md files are skipped", () => {
    const h = vaultOf(bundle, {
      [`${ROOT}/SRD 5e/Homebrew/_compendium.md`]: "---\narchivist_compendium: true\n---\n",
      [`${ROOT}/SRD 5e/Homebrew/Thing.md`]: six("nested"),
      [`${ROOT}/SRD 5e/Backgrounds/Sage.png`]: "PNG",
      [`${ROOT}/SRD 5e/Backgrounds/Orphan.md`]: six("orphan"),
    });
    const folder = h.vault.getAbstractFileByPath(`${ROOT}/SRD 5e`) as TFolder;
    expect(collectPruneCandidates(folder, keepOf(bundle)).map((f) => f.path)).toEqual([`${ROOT}/SRD 5e/Backgrounds/Orphan.md`]);
  });
});

describe("pruneOrphans (G8, G9, G9b, G10, G13)", () => {
  it("G8: exactly the one pristine orphan is trashed among the in-bundle notes; trashFile called once", async () => {
    const h = vaultOf(bundle, { [`${ROOT}/SRD 5e/Backgrounds/Orphan.md`]: six("orphan") });
    const report = await pruneOrphans(h.vault, h.fileManager, { rootFolder: ROOT, compendiumName: "SRD 5e", bundle });
    expect(report).toEqual({ pruned: [`${ROOT}/SRD 5e/Backgrounds/Orphan.md`], keptModified: [], pruneFailures: [] });
    expect(h.log).toEqual([{ kind: "trash", path: `${ROOT}/SRD 5e/Backgrounds/Orphan.md` }]);
    expect(h.files.has(`${ROOT}/SRD 5e/Backgrounds/Acolyte.md`)).toBe(true);
  });
  // The upgrade path against a note-less sub-bundle: without the keep.size guard every pristine note
  // under the compendium is an orphan, all three are trashed, and the stamp then lands on the hole.
  it("G8c: a sub-bundle with no entity keys prunes NOTHING (an empty keep set never empties a compendium)", async () => {
    const h = vaultOf(bundle, {});
    const report = await pruneOrphans(h.vault, h.fileManager, {
      rootFolder: ROOT, compendiumName: "SRD 5e", bundle: { "SRD 5e/_compendium.md": bundle["SRD 5e/_compendium.md"] },
    });
    expect(report).toEqual({ pruned: [], keptModified: [], pruneFailures: [] });
    expect(h.log).toEqual([]);
    expect(h.files.has(`${ROOT}/SRD 5e/Backgrounds/Acolyte.md`)).toBe(true);
    expect(h.files.has(`${ROOT}/SRD 5e/Backgrounds/Sage.md`)).toBe(true);
    expect(h.files.has(`${ROOT}/SRD 5e/Races/Dwarf.md`)).toBe(true);
  });
  it("G9 / G9b / G10: the five-key note, the six+other-key note and the prose note are KEPT; the seven-key legacy note is TRASHED", async () => {
    const h = vaultOf(bundle, {
      [`${ROOT}/SRD 5e/Backgrounds/Mine.md`]: fiveKey,
      [`${ROOT}/SRD 5e/Backgrounds/Rated.md`]: six("rated", "rating: 5\n"),
      [`${ROOT}/SRD 5e/Backgrounds/Prose.md`]: six("prose", "", "\nMy notes.\n"),
      [`${ROOT}/SRD 5e/Backgrounds/Legacy.md`]: six("legacy", "archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'\n"),
    });
    const report = await pruneOrphans(h.vault, h.fileManager, { rootFolder: ROOT, compendiumName: "SRD 5e", bundle });
    expect(report.pruned).toEqual([`${ROOT}/SRD 5e/Backgrounds/Legacy.md`]);
    expect(report.keptModified.sort()).toEqual([
      `${ROOT}/SRD 5e/Backgrounds/Mine.md`, `${ROOT}/SRD 5e/Backgrounds/Prose.md`, `${ROOT}/SRD 5e/Backgrounds/Rated.md`,
    ]);
    expect(report.pruneFailures).toEqual([]);
  });
  it("G13: a trash failure on one path is reported and the other orphan is still pruned", async () => {
    const h = vaultOf(bundle, {
      [`${ROOT}/SRD 5e/Backgrounds/A.md`]: six("a"),
      [`${ROOT}/SRD 5e/Backgrounds/B.md`]: six("b"),
    });
    h.trashThrowsFor(`${ROOT}/SRD 5e/Backgrounds/A.md`);
    const report = await pruneOrphans(h.vault, h.fileManager, { rootFolder: ROOT, compendiumName: "SRD 5e", bundle });
    expect(report.pruned).toEqual([`${ROOT}/SRD 5e/Backgrounds/B.md`]);
    expect(report.pruneFailures).toEqual([{ path: `${ROOT}/SRD 5e/Backgrounds/A.md`, error: `trash refused: ${ROOT}/SRD 5e/Backgrounds/A.md` }]);
  });
  it("reads the DISK (vault.read), not the cache, before trashing", async () => {
    const h = vaultOf(bundle, { [`${ROOT}/SRD 5e/Backgrounds/Orphan.md`]: six("orphan") });
    // The user edits the orphan after the index snapshot: the cache still says pristine, the disk says prose.
    await h.vault.adapter.write(`${ROOT}/SRD 5e/Backgrounds/Orphan.md`, six("orphan", "", "\nEdited.\n"));
    h.log.length = 0;
    const report = await pruneOrphans(h.vault, h.fileManager, { rootFolder: ROOT, compendiumName: "SRD 5e", bundle });
    expect(report.keptModified).toEqual([`${ROOT}/SRD 5e/Backgrounds/Orphan.md`]);
    expect(report.pruned).toEqual([]);
  });
  it("a missing compendium folder prunes nothing", async () => {
    const h = makeHarness({});
    expect(await pruneOrphans(h.vault, h.fileManager, { rootFolder: ROOT, compendiumName: "SRD 5e", bundle }))
      .toEqual({ pruned: [], keptModified: [], pruneFailures: [] });
  });
});
