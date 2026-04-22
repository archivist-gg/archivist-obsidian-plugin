import { describe, it, expect, vi } from "vitest";

// Stub the generated index with a tiny two-entry fixture so this test
// doesn't depend on the prebuild script having run.
vi.mock("../src/data/srd/index.generated", () => ({
  SRD_MD_ENTRIES: [
    { type: "classes", slug: "rogue", content: "---\narchivist: true\nentity_type: class\nslug: rogue\n---\n\n```class\nname: Rogue\n```\n" },
    { type: "races", slug: "dwarf", content: "---\narchivist: true\nentity_type: race\nslug: dwarf\n---\n\n```race\nname: Dwarf\n```\n" },
  ],
}));

import { importSrdBundledMdToVault } from "../src/shared/entities/entity-md-importer";

type FakeAdapter = {
  files: Map<string, string>;
  exists: (p: string) => Promise<boolean>;
  mkdir: (p: string) => Promise<void>;
  write: (p: string, content: string) => Promise<void>;
};

function createFakeVault(): { vault: { adapter: FakeAdapter }; adapter: FakeAdapter } {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const adapter: FakeAdapter = {
    files,
    async exists(p: string) { return files.has(p) || dirs.has(p); },
    async mkdir(p: string) { dirs.add(p); },
    async write(p: string, content: string) { files.set(p, content); },
  };
  return { vault: { adapter }, adapter };
}

describe("importSrdBundledMdToVault", () => {
  it("copies every bundled MD file into the expected vault path", async () => {
    const { vault, adapter } = createFakeVault();
    const created = await importSrdBundledMdToVault(vault as unknown as import("obsidian").Vault, "Compendium");
    expect(created).toBe(2);
    expect(adapter.files.has("Compendium/SRD/Classes/rogue.md")).toBe(true);
    expect(adapter.files.has("Compendium/SRD/Races/dwarf.md")).toBe(true);
  });

  it("skips files that already exist", async () => {
    const { vault, adapter } = createFakeVault();
    adapter.files.set("Compendium/SRD/Classes/rogue.md", "existing content");
    const created = await importSrdBundledMdToVault(vault as unknown as import("obsidian").Vault, "Compendium");
    expect(created).toBe(1);
    expect(adapter.files.get("Compendium/SRD/Classes/rogue.md")).toBe("existing content");
  });

  it("fires progress callback for every entry", async () => {
    const { vault } = createFakeVault();
    const calls: Array<[number, number]> = [];
    await importSrdBundledMdToVault(vault as unknown as import("obsidian").Vault, "Compendium", (c, t) => calls.push([c, t]));
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual([2, 2]);
  });
});
