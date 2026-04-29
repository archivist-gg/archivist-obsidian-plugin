import { describe, it, expect } from "vitest";
import { rewriteFrontmatter } from "../../src/shared/compendium-init/frontmatter-rewrite";
import type { Vault } from "obsidian";

interface VaultFixture {
  files: Record<string, string>;
}

function makeVault(fixture: VaultFixture, writeCalls: Array<{ path: string; content: string }>): Vault {
  return {
    adapter: {
      exists: async (p: string) => {
        if (fixture.files[p] !== undefined) return true;
        const prefix = p.endsWith("/") ? p : `${p}/`;
        return Object.keys(fixture.files).some(f => f.startsWith(prefix));
      },
      list: async (p: string) => {
        const prefix = p.endsWith("/") ? p : `${p}/`;
        const files = new Set<string>();
        const folders = new Set<string>();
        for (const path of Object.keys(fixture.files)) {
          if (!path.startsWith(prefix)) continue;
          const rest = path.slice(prefix.length);
          const slash = rest.indexOf("/");
          if (slash === -1) files.add(path);
          else folders.add(prefix + rest.slice(0, slash));
        }
        return { files: Array.from(files), folders: Array.from(folders) };
      },
      read: async (p: string) => {
        const c = fixture.files[p];
        if (c === undefined) throw new Error(`not found: ${p}`);
        return c;
      },
      write: async (p: string, c: string) => {
        writeCalls.push({ path: p, content: c });
        fixture.files[p] = c;
      },
    },
  } as unknown as Vault;
}

describe("rewriteFrontmatter", () => {
  it("applies the transform and rewrites changed files", async () => {
    const fixture: VaultFixture = {
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          "---\nslug: fireball\ncompendium: SRD\n---\nbody",
        "Compendium/SRD/Races/Elf.md":
          "---\nslug: elf\ncompendium: SRD\n---\nbody",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const count = await rewriteFrontmatter(vault, "Compendium/SRD", fm => ({
      ...fm,
      compendium: "SRD 5e",
    }));
    expect(count).toBe(2);
    expect(writeCalls.find(c => c.path === "Compendium/SRD/Spells/Fireball.md")?.content).toContain("compendium: SRD 5e");
    expect(writeCalls.find(c => c.path === "Compendium/SRD/Spells/Fireball.md")?.content).toContain("body");
  });

  it("identity transform writes nothing", async () => {
    const fixture: VaultFixture = {
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          "---\nslug: fireball\ncompendium: SRD\n---\nbody",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const count = await rewriteFrontmatter(vault, "Compendium/SRD", fm => fm);
    expect(count).toBe(0);
    expect(writeCalls).toEqual([]);
  });

  it("skips malformed files (no frontmatter)", async () => {
    const fixture: VaultFixture = {
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          "no frontmatter here, just body",
        "Compendium/SRD/Races/Elf.md":
          "---\nslug: elf\ncompendium: SRD\n---\nbody",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const count = await rewriteFrontmatter(vault, "Compendium/SRD", fm => ({
      ...fm,
      compendium: "SRD 5e",
    }));
    expect(count).toBe(1);
    expect(writeCalls.map(c => c.path)).toEqual(["Compendium/SRD/Races/Elf.md"]);
  });
});
