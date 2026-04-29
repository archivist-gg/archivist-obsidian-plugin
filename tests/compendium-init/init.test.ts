import { describe, it, expect, vi, beforeEach } from "vitest";
import { initializeCompendium } from "../../src/shared/compendium-init/init";
import type { Vault } from "obsidian";

interface MockVault {
  adapter: {
    exists: (path: string) => Promise<boolean>;
    mkdir: (path: string) => Promise<void>;
    write: (path: string, content: string) => Promise<void>;
    read: (path: string) => Promise<string>;
    list: (path: string) => Promise<{ files: string[]; folders: string[] }>;
  };
}

function makeVault(opts: {
  exists?: (p: string) => boolean;
  read?: (p: string) => string;
  onMkdir?: (p: string) => void;
  onWrite?: (p: string, c: string) => void;
}): MockVault {
  return {
    adapter: {
      exists: vi.fn(async (p: string) => (opts.exists ? opts.exists(p) : false)),
      read: vi.fn(async (p: string) => (opts.read ? opts.read(p) : "")),
      mkdir: vi.fn(async (p: string) => { opts.onMkdir?.(p); }),
      write: vi.fn(async (p: string, c: string) => { opts.onWrite?.(p, c); }),
      list: vi.fn(),
    },
  };
}

describe("initializeCompendium", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'skipped' when installed version matches bundle version", async () => {
    const indexPath = "Compendium/SRD 5e/_compendium.md";
    const md = [
      "---",
      "archivist_compendium: true",
      "archivist_compendium_version: 1.0.0",
      "---",
    ].join("\n");
    const writes: Array<{ path: string; content: string }> = [];
    const vault = makeVault({
      exists: (p) => p === indexPath,
      read: () => md,
      onWrite: (path, content) => writes.push({ path, content }),
    });

    const result = await initializeCompendium(vault as unknown as Vault, {
      rootFolder: "Compendium",
      compendiumName: "SRD 5e",
      bundle: { "SRD 5e/Races/Dwarf.md": "x" },
      bundleVersion: "1.0.0",
    });

    expect(result).toBe("skipped");
    expect(writes.length).toBe(0);
  });

  it("returns 'copied' when version differs (fresh install or upgrade)", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const vault = makeVault({
      exists: () => false, // no installed _compendium.md
      onWrite: (path, content) => writes.push({ path, content }),
    });

    const result = await initializeCompendium(vault as unknown as Vault, {
      rootFolder: "Compendium",
      compendiumName: "SRD 5e",
      bundle: {
        "SRD 5e/_compendium.md": "---\narchivist_compendium: true\n---",
        "SRD 5e/Races/Dwarf.md": "---\nname: Dwarf\n---",
      },
      bundleVersion: "1.0.0",
    });

    expect(result).toBe("copied");
    expect(writes.length).toBe(2);
    expect(writes.find(w => w.path === "Compendium/SRD 5e/Races/Dwarf.md")).toBeTruthy();
  });
});
