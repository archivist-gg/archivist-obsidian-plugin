import { describe, it, expect, beforeEach } from "vitest";
import { backupFiles } from "../../src/shared/compendium-init/backup";
import type { Vault } from "obsidian";

interface MockState {
  files: Record<string, string>;
  folders: Set<string>;
  mkdirCalls: string[];
  writeCalls: Array<{ path: string; content: string }>;
}

function makeVault(state: MockState): Vault {
  return {
    adapter: {
      exists: async (p: string) => {
        if (state.files[p] !== undefined) return true;
        if (state.folders.has(p)) return true;
        return false;
      },
      mkdir: async (p: string) => {
        state.mkdirCalls.push(p);
        state.folders.add(p);
      },
      read: async (p: string) => {
        const c = state.files[p];
        if (c === undefined) throw new Error(`not found: ${p}`);
        return c;
      },
      write: async (p: string, c: string) => {
        state.writeCalls.push({ path: p, content: c });
        state.files[p] = c;
      },
    },
  } as unknown as Vault;
}

describe("backupFiles", () => {
  let state: MockState;
  let vault: Vault;

  beforeEach(() => {
    state = {
      files: {
        "Compendium/SRD/Spells/Fireball.md": "fireball-content",
        "Compendium/SRD/Spells/Magic Missile.md": "magic-missile-content",
        "Compendium/SRD/Races/Elf.md": "elf-content",
      },
      folders: new Set([
        "Compendium",
        "Compendium/SRD",
        "Compendium/SRD/Spells",
        "Compendium/SRD/Races",
      ]),
      mkdirCalls: [],
      writeCalls: [],
    };
    vault = makeVault(state);
  });

  it("copies each file under sourceRoot to backupRoot preserving subfolders", async () => {
    await backupFiles(
      vault,
      "Compendium/SRD",
      [
        "Compendium/SRD/Spells/Fireball.md",
        "Compendium/SRD/Races/Elf.md",
      ],
      "Compendium/SRD.backup.001",
    );
    expect(state.mkdirCalls).toContain("Compendium/SRD.backup.001");
    expect(state.mkdirCalls).toContain("Compendium/SRD.backup.001/Spells");
    expect(state.mkdirCalls).toContain("Compendium/SRD.backup.001/Races");
    expect(state.writeCalls.find(c => c.path === "Compendium/SRD.backup.001/Spells/Fireball.md")?.content).toBe("fireball-content");
    expect(state.writeCalls.find(c => c.path === "Compendium/SRD.backup.001/Races/Elf.md")?.content).toBe("elf-content");
  });

  it("idempotent — calling twice doesn't error and content remains correct", async () => {
    const args = [
      vault,
      "Compendium/SRD",
      ["Compendium/SRD/Spells/Fireball.md"],
      "Compendium/SRD.backup.001",
    ] as const;
    await backupFiles(...args);
    await backupFiles(...args);
    expect(state.files["Compendium/SRD.backup.001/Spells/Fireball.md"]).toBe("fireball-content");
    expect(state.writeCalls.length).toBe(2);
  });
});
