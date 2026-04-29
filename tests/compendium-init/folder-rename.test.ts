import { describe, it, expect } from "vitest";
import { renameFolder } from "../../src/shared/compendium-init/folder-rename";
import type { Vault } from "obsidian";

interface RenameCall {
  from: string;
  to: string;
}

function makeVault(existing: Set<string>, calls: RenameCall[]): Vault {
  return {
    adapter: {
      exists: async (p: string) => existing.has(p),
      rename: async (from: string, to: string) => {
        calls.push({ from, to });
        existing.delete(from);
        existing.add(to);
      },
    },
  } as unknown as Vault;
}

describe("renameFolder", () => {
  it("renames when the old path exists", async () => {
    const existing = new Set(["Compendium/SRD"]);
    const calls: RenameCall[] = [];
    const vault = makeVault(existing, calls);
    const result = await renameFolder(vault, "Compendium/SRD", "Compendium/SRD 5e");
    expect(result).toBe("renamed");
    expect(calls).toEqual([{ from: "Compendium/SRD", to: "Compendium/SRD 5e" }]);
  });

  it("noop when the old path does not exist", async () => {
    const existing = new Set<string>();
    const calls: RenameCall[] = [];
    const vault = makeVault(existing, calls);
    const result = await renameFolder(vault, "Compendium/SRD", "Compendium/SRD 5e");
    expect(result).toBe("noop");
    expect(calls).toEqual([]);
  });
});
