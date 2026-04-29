import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getInstalledCompendiumVersion,
  compareWithBundle,
} from "../../src/shared/compendium-init/compendium-version";
import type { Vault } from "obsidian";

interface MockVault {
  adapter: {
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
  };
}

function makeVault(opts: {
  exists?: (p: string) => boolean;
  read?: (p: string) => string;
}): MockVault {
  return {
    adapter: {
      exists: vi.fn(async (p: string) => (opts.exists ? opts.exists(p) : false)),
      read: vi.fn(async (p: string) => (opts.read ? opts.read(p) : "")),
    },
  };
}

describe("getInstalledCompendiumVersion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the _compendium.md file is missing", async () => {
    const vault = makeVault({ exists: () => false });
    const v = await getInstalledCompendiumVersion(vault as unknown as Vault, "Compendium/SRD 5e");
    expect(v).toBeNull();
  });

  it("parses the version from valid frontmatter", async () => {
    const md = [
      "---",
      "archivist_compendium: true",
      "name: SRD 5e",
      "archivist_compendium_version: 1.2.3",
      "---",
      "",
      "# SRD 5e",
    ].join("\n");
    const vault = makeVault({
      exists: () => true,
      read: () => md,
    });
    const v = await getInstalledCompendiumVersion(vault as unknown as Vault, "Compendium/SRD 5e");
    expect(v).toBe("1.2.3");
  });
});

describe("compareWithBundle", () => {
  it("returns fresh / up-to-date / upgrade-available for the three input combinations", () => {
    expect(compareWithBundle(null, "1.0.0")).toBe("fresh");
    expect(compareWithBundle("1.0.0", "1.0.0")).toBe("up-to-date");
    expect(compareWithBundle("1.0.0", "1.1.0")).toBe("upgrade-available");
  });
});
