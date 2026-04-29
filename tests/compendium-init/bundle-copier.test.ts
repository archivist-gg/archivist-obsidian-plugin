import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyBundle } from "../../src/shared/compendium-init/bundle-copier";
import type { Vault } from "obsidian";

interface MockVault {
  adapter: {
    exists: (path: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
    write: (path: string, content: string) => Promise<void>;
    list: (path: string) => Promise<{ files: string[]; folders: string[] }>;
    read: (path: string) => Promise<string>;
  };
}

describe("copyBundle", () => {
  let vault: MockVault;
  let mkdirCalls: string[];
  let writeCalls: Array<{ path: string; content: string }>;

  beforeEach(() => {
    mkdirCalls = [];
    writeCalls = [];
    vault = {
      adapter: {
        exists: vi.fn(async () => false),
        mkdir: vi.fn(async (p: string) => { mkdirCalls.push(p); }),
        write: vi.fn(async (p: string, c: string) => { writeCalls.push({ path: p, content: c }); }),
        list: vi.fn(),
        read: vi.fn(),
      },
    };
  });

  it("creates target folder + writes each file from the bundle map", async () => {
    const bundle: Record<string, string> = {
      "SRD 5e/_compendium.md": "---\narchivist_compendium: true\n---",
      "SRD 5e/Races/Dwarf.md": "---\nname: Dwarf\n---",
      "SRD 5e/Feats/Grappler.md": "---\nname: Grappler\n---",
    };
    await copyBundle(vault as unknown as Vault, "Compendium", bundle);

    expect(mkdirCalls).toContain("Compendium/SRD 5e");
    expect(mkdirCalls).toContain("Compendium/SRD 5e/Races");
    expect(mkdirCalls).toContain("Compendium/SRD 5e/Feats");
    expect(writeCalls.length).toBe(3);
    expect(writeCalls.find(c => c.path === "Compendium/SRD 5e/Races/Dwarf.md")?.content).toContain("Dwarf");
  });

  it("idempotent — calling twice doesn't duplicate writes (overwrites are fine)", async () => {
    const bundle = { "SRD 5e/X.md": "x" };
    await copyBundle(vault as unknown as Vault, "Compendium", bundle);
    await copyBundle(vault as unknown as Vault, "Compendium", bundle);
    expect(writeCalls.length).toBe(2);
    expect(writeCalls.every(c => c.content === "x")).toBe(true);
  });
});
