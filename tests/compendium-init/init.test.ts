import { describe, it, expect } from "vitest";
import { planCompendium, applyCompendium, type InitCompendiumOptions } from "../../packages/obsidian/src/shared/compendium-init/init";
import { makeHarness, type Harness } from "./harness";

const ROOT = "Compendium";
const index = (name: string, version: string, extra = "") =>
  `---\narchivist_compendium: true\nname: ${name}\nreadonly: true\n${extra}homebrew: false\narchivist_compendium_version: ${version}\n---\n\n# ${name}\n`;
const note = (slug: string) =>
  `---\narchivist: true\nentity_type: race\nslug: ${slug}\nname: ${slug}\ncompendium: SRD 5e\nsource: SRD 5.1\n---\n\n\`\`\`race\nslug: ${slug}\n\`\`\`\n`;
const bundleA = {
  "SRD 5e/_compendium.md": index("SRD 5e", "7.7.7"),
  "SRD 5e/Races/Dwarf.md": note("srd-5e_race_dwarf"),
  "SRD 5e/Races/Elf.md": note("srd-5e_race_elf"),
};
const bundleB = {
  "SRD 2024/_compendium.md": index("SRD 2024", "5.5.5"),
  "SRD 2024/Races/Human.md": note("srd-2024_race_human"),
};
const optsA = { rootFolder: ROOT, compendiumName: "SRD 5e", bundle: bundleA };
const optsB = { rootFolder: ROOT, compendiumName: "SRD 2024", bundle: bundleB };
const run = async (h: Harness, opts: InitCompendiumOptions) =>
  applyCompendium(h.vault, h.fileManager, opts, await planCompendium(h.vault, opts));
// Chronological: no sort. The order IS the assertion (spec §5.4, §9 G1).
const writes = (h: Harness, prefix: string) =>
  h.log.filter((e) => (e.kind === "write" || e.kind === "process") && e.path.startsWith(prefix)).map((e) => e.path);

describe("planCompendium", () => {
  it("G4: a sub-bundle without an index entry plans error with a reason", async () => {
    const h = makeHarness({});
    const entry = await planCompendium(h.vault, { ...optsA, bundle: { "SRD 5e/Races/Dwarf.md": "x" } });
    expect(entry.action).toBe("error");
    expect(entry.bundleVersion).toBeNull();
    expect(entry.reason).toBe("could not read the bundled version for SRD 5e; nothing copied");
  });
});

describe("applyCompendium · G1 converges, per compendium", () => {
  // Initial files are indexed at harness construction, so the upgrade's index write is a
  // `process` event (not an adapter `write`); writes() collects both kinds in order.
  it("run 1 upgrades ONLY the differing compendium with exactly its own paths; run 2 writes zero files", async () => {
    const h = makeHarness({
      [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "0.0.1"),
      [`${ROOT}/SRD 2024/_compendium.md`]: index("SRD 2024", "5.5.5"),
      [`${ROOT}/SRD 2024/Races/Human.md`]: note("srd-2024_race_human"),
      // A pristine orphan INSIDE the up-to-date sibling: only a prune invoked on an up-to-date
      // entry can trash it (a scan rooted at <root> skips the sibling's folder whole, because
      // that folder's direct children include a _compendium.md).
      [`${ROOT}/SRD 2024/Races/Orc.md`]: note("srd-2024_race_orc"),
      // A pristine orphan OUTSIDE any compendium: correct code never visits Loose/, a scan
      // rooted at <root> walks into it and trashes this file.
      [`${ROOT}/Loose/Orphan.md`]: note("srd-5e_race_loose"),
    });
    const a = await run(h, optsA);
    const b = await run(h, optsB);
    expect(a.action).toBe("upgraded");
    expect(b.action).toBe("skipped");
    expect(writes(h, `${ROOT}/SRD 5e/`)).toEqual([`${ROOT}/SRD 5e/Races/Dwarf.md`, `${ROOT}/SRD 5e/Races/Elf.md`, `${ROOT}/SRD 5e/_compendium.md`]);
    expect(h.log.filter((e) => e.path.startsWith(`${ROOT}/SRD 2024/`) || e.path.startsWith(`${ROOT}/Loose/`))).toEqual([]);
    expect(h.files.has(`${ROOT}/SRD 2024/Races/Orc.md`)).toBe(true);
    expect(h.files.has(`${ROOT}/Loose/Orphan.md`)).toBe(true);
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toContain("archivist_compendium_version: 7.7.7");
    h.reindex();
    h.log.length = 0;
    expect((await run(h, optsA)).action).toBe("skipped");
    expect((await run(h, optsB)).action).toBe("skipped");
    expect(h.log).toEqual([]);
  });
});

describe("applyCompendium · fresh (G6, G7 fresh arm, G12)", () => {
  it("installs verbatim, entity files before the index, and prunes nothing even with orphans present", async () => {
    const h = makeHarness({ [`${ROOT}/SRD 5e/Races/Orphan.md`]: note("orphan") });   // folder exists, no index file
    const r = await run(h, optsA);
    expect(r.action).toBe("installed");
    expect(r.pruned).toEqual([]);
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toBe(bundleA["SRD 5e/_compendium.md"]);
    expect(h.files.has(`${ROOT}/SRD 5e/Races/Orphan.md`)).toBe(true);
    const paths = h.log.map((e) => e.path);
    expect(paths.length).toBe(3);
    expect(paths[paths.length - 1]).toBe(`${ROOT}/SRD 5e/_compendium.md`);
    expect(h.log.every((e) => e.kind === "write")).toBe(true);
  });
});

describe("applyCompendium · upgrade (G3, G3b, G7 upgrade arm, G13)", () => {
  it("G3: an unreadable-but-parseable index (float stamp) upgrades through the merge, keeps readonly:false, and prunes", async () => {
    const h = makeHarness({
      [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "1.0").replace("readonly: true", "readonly: false"),
      [`${ROOT}/SRD 5e/Races/Gnome.md`]: note("srd-5e_race_gnome"),   // pristine orphan: the unreadable path prunes (spec §5.5 ruling)
    });
    const r = await run(h, optsA);
    expect(r.action).toBe("upgraded");
    expect(r.indexWrite).toBe("process");
    expect(r.pruned).toEqual([`${ROOT}/SRD 5e/Races/Gnome.md`]);
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toContain("readonly: false");
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toContain("archivist_compendium_version: 7.7.7");
  });
  it("G3b: an unparseable index is replaced verbatim, prunes, and the second run is up-to-date", async () => {
    const h = makeHarness({
      [`${ROOT}/SRD 5e/_compendium.md`]: "# bare, no frontmatter\n",
      [`${ROOT}/SRD 5e/Races/Gnome.md`]: note("srd-5e_race_gnome"),
    });
    const r = await run(h, optsA);
    expect(r.action).toBe("upgraded");
    expect(r.pruned).toEqual([`${ROOT}/SRD 5e/Races/Gnome.md`]);
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toBe(bundleA["SRD 5e/_compendium.md"]);
    h.reindex();
    expect((await run(h, optsA)).action).toBe("skipped");
  });
  it("G7: the index event is LAST, after every entity write and after every trash", async () => {
    const h = makeHarness({
      [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "0.0.1"),
      [`${ROOT}/SRD 5e/Races/Gnome.md`]: note("srd-5e_race_gnome"),   // a pristine orphan: will be trashed
    });
    const r = await run(h, optsA);
    expect(r.pruned).toEqual([`${ROOT}/SRD 5e/Races/Gnome.md`]);
    const kinds = h.log.map((e) => e.kind);
    expect(kinds.filter((k) => k === "write").length).toBe(2);
    expect(kinds.filter((k) => k === "trash").length).toBe(1);
    expect(h.log[h.log.length - 1]).toEqual({ kind: "process", path: `${ROOT}/SRD 5e/_compendium.md` });
    expect(kinds.indexOf("trash")).toBeGreaterThan(kinds.lastIndexOf("write"));
  });
  it("G13 (apply level): a trash failure is reported, the index is still stamped, action is upgraded", async () => {
    const h = makeHarness({
      [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "0.0.1"),
      [`${ROOT}/SRD 5e/Races/Gnome.md`]: note("srd-5e_race_gnome"),
    });
    h.trashThrowsFor(`${ROOT}/SRD 5e/Races/Gnome.md`);
    const r = await run(h, optsA);
    expect(r.action).toBe("upgraded");
    expect(r.pruneFailures.map((f) => f.path)).toEqual([`${ROOT}/SRD 5e/Races/Gnome.md`]);
    expect(h.files.get(`${ROOT}/SRD 5e/_compendium.md`)).toContain("archivist_compendium_version: 7.7.7");
  });
  it("G4 (apply level): an error entry copies nothing, and the sibling still installs", async () => {
    const h = makeHarness({});
    // The erroring sub-bundle HAS an index entry, present but unparseable, so the `error`
    // early-return is what stops the copy; a missing entry would let the baked-string guard
    // mask a deleted early-return (Gate 2 finding).
    const bad = { ...optsA, bundle: { "SRD 5e/_compendium.md": "# bare", "SRD 5e/Races/Dwarf.md": note("srd-5e_race_dwarf") } };
    const r = await run(h, bad);
    expect(r.action).toBe("error");
    expect(r.reason).toBe("could not read the bundled version for SRD 5e; nothing copied");
    expect(h.log).toEqual([]);
    expect((await run(h, optsB)).action).toBe("installed");
    expect(h.log.filter((e) => e.path.startsWith(`${ROOT}/SRD 5e/`))).toEqual([]);
  });
});
