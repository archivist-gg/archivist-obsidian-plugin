import { describe, it, expect } from "vitest";
import {
  planCompendiumBootstrap,
  applyCompendiumBootstrap,
  describeBootstrapResult,
  type CompendiumBootstrapResult,
} from "../../packages/obsidian/src/shared/compendium-init/wiring";
import { makeHarness } from "./harness";

const ROOT = "Compendium";
const index = (name: string, version: string) =>
  `---\narchivist_compendium: true\nname: ${name}\nreadonly: true\nhomebrew: false\narchivist_compendium_version: ${version}\n---\n\n# ${name}\n`;
const note = (slug: string, comp: string) =>
  `---\narchivist: true\nentity_type: race\nslug: ${slug}\nname: ${slug}\ncompendium: ${comp}\nsource: SRD\n---\n\n\`\`\`race\nslug: ${slug}\n\`\`\`\n`;
const bundle = {
  "SRD 5e/_compendium.md": index("SRD 5e", "7.7.7"),
  "SRD 5e/Races/Dwarf.md": note("srd-5e_race_dwarf", "SRD 5e"),
  "SRD 2024/_compendium.md": index("SRD 2024", "5.5.5"),
  "SRD 2024/Races/Human.md": note("srd-2024_race_human", "SRD 2024"),
};
const upToDate = {
  [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "7.7.7"),
  [`${ROOT}/SRD 5e/Races/Dwarf.md`]: note("srd-5e_race_dwarf", "SRD 5e"),
  [`${ROOT}/SRD 2024/_compendium.md`]: index("SRD 2024", "5.5.5"),
  [`${ROOT}/SRD 2024/Races/Human.md`]: note("srd-2024_race_human", "SRD 2024"),
};
const opts = (h: ReturnType<typeof makeHarness>) => ({ vault: h.vault, fileManager: h.fileManager, rootFolder: ROOT, removeLegacySrdFolder: true });

describe("planCompendiumBootstrap · G14 shouldNotify", () => {
  it("false for all-up-to-date with no legacy folder", async () => {
    const h = makeHarness(upToDate);
    const plan = await planCompendiumBootstrap(opts(h), bundle);
    expect(plan.entries.map((e) => e.action)).toEqual(["up-to-date", "up-to-date"]);
    expect(plan.legacySrdPresent).toBe(false);
    expect(plan.shouldNotify).toBe(false);
    expect(h.log).toEqual([]);   // planning writes nothing
  });
  it("true for fresh, for upgrade, for error, and for a legacy folder alone", async () => {
    expect((await planCompendiumBootstrap(opts(makeHarness({})), bundle)).shouldNotify).toBe(true);
    const up = makeHarness({ ...upToDate, [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "0.0.1") });
    expect((await planCompendiumBootstrap(opts(up), bundle)).shouldNotify).toBe(true);
    const err = makeHarness(upToDate);
    expect((await planCompendiumBootstrap(opts(err), { ...bundle, "SRD 2024/_compendium.md": "# bare" })).shouldNotify).toBe(true);
    const legacy = makeHarness({ ...upToDate, [`${ROOT}/SRD/Old.md`]: "x" });
    const plan = await planCompendiumBootstrap(opts(legacy), bundle);
    expect(plan.legacySrdPresent).toBe(true);
    expect(plan.shouldNotify).toBe(true);
  });
});

describe("applyCompendiumBootstrap", () => {
  it("trashes the legacy Compendium/SRD folder and applies every entry", async () => {
    const h = makeHarness({ [`${ROOT}/SRD/Old.md`]: "x" });
    const plan = await planCompendiumBootstrap(opts(h), bundle);
    const result = await applyCompendiumBootstrap(opts(h), plan, bundle);
    expect(result.legacySrdRemoved).toBe(true);
    expect(h.log[0]).toEqual({ kind: "trash", path: `${ROOT}/SRD` });
    expect(result.perCompendium.map((r) => r.action)).toEqual(["installed", "installed"]);
  });
  it("G13b: a throw inside one compendium becomes an error entry and the sibling still installs", async () => {
    const h = makeHarness({});
    const plan = await planCompendiumBootstrap(opts(h), bundle);
    h.adapterThrowsFor("write", `${ROOT}/SRD 5e/Races/Dwarf.md`);   // copyBundle's first write for SRD 5e rejects
    const result = await applyCompendiumBootstrap(opts(h), plan, bundle);
    const byName = Object.fromEntries(result.perCompendium.map((r) => [r.compendium, r]));
    expect(byName["SRD 5e"].action).toBe("error");
    expect(byName["SRD 5e"].reason).toBe(`SRD 5e failed: disk full: ${ROOT}/SRD 5e/Races/Dwarf.md; existing notes kept`);
    expect(byName["SRD 2024"].action).toBe("installed");
  });
  it("G13c: an IO rejection reading one compendium's index at PLAN time becomes an error entry; the sibling is planned and installed", async () => {
    const h = makeHarness({ [`${ROOT}/SRD 5e/_compendium.md`]: index("SRD 5e", "0.0.1") });
    h.adapterThrowsFor("read", `${ROOT}/SRD 5e/_compendium.md`);
    const plan = await planCompendiumBootstrap(opts(h), bundle);
    const byName = Object.fromEntries(plan.entries.map((e) => [e.compendium, e]));
    expect(byName["SRD 5e"]).toEqual({
      compendium: "SRD 5e", action: "error", installed: { state: "unreadable" }, bundleVersion: null,
      reason: `SRD 5e failed: EACCES: ${ROOT}/SRD 5e/_compendium.md; existing notes kept`,
    });
    expect(byName["SRD 2024"].action).toBe("fresh");
    expect(plan.shouldNotify).toBe(true);
    const result = await applyCompendiumBootstrap(opts(h), plan, bundle);
    expect(result.perCompendium.map((r) => r.action)).toEqual(["error", "installed"]);
    expect(h.log.filter((e) => e.path.startsWith(`${ROOT}/SRD 5e/`))).toEqual([]);
  });
});

describe("describeBootstrapResult · G15", () => {
  const r = (perCompendium: CompendiumBootstrapResult["perCompendium"], legacySrdRemoved = false): CompendiumBootstrapResult =>
    ({ legacySrdRemoved, perCompendium });
  const empty = { pruned: [], keptModified: [], pruneFailures: [] };
  it.each([
    [r([{ compendium: "SRD 5e", action: "skipped", ...empty }, { compendium: "SRD 2024", action: "skipped", ...empty }]), "Archivist: compendiums up-to-date"],
    [r([{ compendium: "SRD 5e", action: "installed", ...empty }, { compendium: "SRD 2024", action: "installed", ...empty }]), "Archivist: installed SRD 5e + SRD 2024"],
    [r([{ compendium: "SRD 5e", action: "upgraded", pruned: ["a", "b", "c"], keptModified: ["d"], pruneFailures: [] }, { compendium: "SRD 2024", action: "skipped", ...empty }]), "Archivist: updated SRD 5e (pruned 3 stale notes, kept 1 modified)"],
    [r([{ compendium: "SRD 5e", action: "upgraded", pruned: ["a"], keptModified: [], pruneFailures: [{ path: "x", error: "e" }] }]), "Archivist: updated SRD 5e (pruned 1 stale note, 1 could not be trashed)"],
    [r([{ compendium: "SRD 5e", action: "upgraded", ...empty }]), "Archivist: updated SRD 5e"],
    [r([{ compendium: "SRD 2024", action: "error", reason: "could not read the bundled version for SRD 2024; nothing copied", ...empty }]), "Archivist: could not read the bundled version for SRD 2024; nothing copied"],
    [r([{ compendium: "SRD 5e", action: "skipped", ...empty }], true), "Archivist: compendiums up-to-date (legacy SRD removed)"],
  ])("composes %#", (result, expected) => {
    const text = describeBootstrapResult(result);
    expect(text).toBe(expected);
    expect(text).not.toContain("\u2014");
  });
});
