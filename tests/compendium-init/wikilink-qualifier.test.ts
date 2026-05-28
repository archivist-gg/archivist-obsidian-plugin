import { describe, it, expect } from "vitest";
import { qualifyWikilinks } from "../../src/shared/compendium-init/wikilink-qualifier";
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
        return p === "" || Object.keys(fixture.files).some(f => f.startsWith(prefix));
      },
      list: async (p: string) => {
        const prefix = p === "" ? "" : (p.endsWith("/") ? p : `${p}/`);
        const files = new Set<string>();
        const folders = new Set<string>();
        for (const path of Object.keys(fixture.files)) {
          if (prefix && !path.startsWith(prefix)) continue;
          const rest = prefix ? path.slice(prefix.length) : path;
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

const slugMap = new Map<string, string>([
  ["fireball", "SRD 5e/Spells/Fireball"],
  ["magic missile", "SRD 5e/Spells/Magic Missile"],
]);

describe("qualifyWikilinks", () => {
  it("qualifies a known unqualified slug", async () => {
    const fixture: VaultFixture = {
      files: {
        "Notes/Session1.md": "I cast [[fireball]] at the goblin.",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const r = await qualifyWikilinks(vault, "Notes", slugMap);
    expect(r.filesScanned).toBe(1);
    expect(r.linksRewritten).toBe(1);
    expect(fixture.files["Notes/Session1.md"]).toBe(
      "I cast [[SRD 5e/Spells/Fireball|fireball]] at the goblin.",
    );
  });

  it("preserves alias-style [[slug|alias]]", async () => {
    const fixture: VaultFixture = {
      files: {
        "Notes/Session1.md": "I cast [[fireball|a fiery blast]] at the goblin.",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const r = await qualifyWikilinks(vault, "Notes", slugMap);
    expect(r.linksRewritten).toBe(1);
    expect(fixture.files["Notes/Session1.md"]).toBe(
      "I cast [[SRD 5e/Spells/Fireball|a fiery blast]] at the goblin.",
    );
  });

  it("skips already-qualified wikilinks", async () => {
    const fixture: VaultFixture = {
      files: {
        "Notes/Session1.md": "I cast [[SRD 5e/Spells/Fireball]] at the goblin.",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const r = await qualifyWikilinks(vault, "Notes", slugMap);
    expect(r.linksRewritten).toBe(0);
    expect(writeCalls).toEqual([]);
    expect(fixture.files["Notes/Session1.md"]).toBe(
      "I cast [[SRD 5e/Spells/Fireball]] at the goblin.",
    );
  });

  it("skips wikilinks inside fenced code blocks", async () => {
    const fixture: VaultFixture = {
      files: {
        "Notes/Session1.md":
          "Outside [[fireball]] yes.\n\n```\nIn block [[fireball]] no.\n```\n",
      },
    };
    const writeCalls: Array<{ path: string; content: string }> = [];
    const vault = makeVault(fixture, writeCalls);
    const r = await qualifyWikilinks(vault, "Notes", slugMap);
    expect(r.linksRewritten).toBe(1);
    expect(fixture.files["Notes/Session1.md"]).toBe(
      "Outside [[SRD 5e/Spells/Fireball|fireball]] yes.\n\n```\nIn block [[fireball]] no.\n```\n",
    );
  });
});
