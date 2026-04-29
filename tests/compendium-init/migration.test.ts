import { describe, it, expect } from "vitest";
import { runMigration } from "../../src/shared/compendium-init/migration";
import type { Vault } from "obsidian";

interface VaultState {
  files: Record<string, string>;
  folders: Set<string>;
}

function makeVault(state: VaultState): Vault {
  const folderHasDescendant = (folder: string): boolean => {
    const prefix = folder.endsWith("/") ? folder : `${folder}/`;
    if (Object.keys(state.files).some(f => f.startsWith(prefix))) return true;
    for (const f of state.folders) if (f.startsWith(prefix)) return true;
    return false;
  };
  return {
    adapter: {
      exists: async (p: string) => {
        if (p === "") return true;
        if (state.files[p] !== undefined) return true;
        if (state.folders.has(p)) return true;
        return folderHasDescendant(p);
      },
      mkdir: async (p: string) => { state.folders.add(p); },
      list: async (p: string) => {
        const prefix = p === "" ? "" : (p.endsWith("/") ? p : `${p}/`);
        const files = new Set<string>();
        const folders = new Set<string>();
        for (const path of Object.keys(state.files)) {
          if (prefix && !path.startsWith(prefix)) continue;
          const rest = prefix ? path.slice(prefix.length) : path;
          const slash = rest.indexOf("/");
          if (slash === -1) files.add(path);
          else folders.add(prefix + rest.slice(0, slash));
        }
        for (const f of state.folders) {
          if (!prefix || (f.startsWith(prefix) && f !== p)) {
            const rest = prefix ? f.slice(prefix.length) : f;
            if (!rest) continue;
            const slash = rest.indexOf("/");
            const top = prefix + (slash === -1 ? rest : rest.slice(0, slash));
            if (top !== p) folders.add(top);
          }
        }
        return { files: Array.from(files), folders: Array.from(folders) };
      },
      read: async (p: string) => {
        const c = state.files[p];
        if (c === undefined) throw new Error(`not found: ${p}`);
        return c;
      },
      write: async (p: string, c: string) => { state.files[p] = c; },
      rename: async (from: string, to: string) => {
        // Rename a folder: shift every file/folder under `from` to `to`.
        const fromPrefix = from.endsWith("/") ? from : `${from}/`;
        const toPrefix = to.endsWith("/") ? to : `${to}/`;
        const newFiles: Record<string, string> = {};
        for (const [path, content] of Object.entries(state.files)) {
          if (path === from) {
            newFiles[to] = content;
          } else if (path.startsWith(fromPrefix)) {
            newFiles[toPrefix + path.slice(fromPrefix.length)] = content;
          } else {
            newFiles[path] = content;
          }
        }
        state.files = newFiles;
        const newFolders = new Set<string>();
        for (const f of state.folders) {
          if (f === from) newFolders.add(to);
          else if (f.startsWith(fromPrefix)) newFolders.add(toPrefix + f.slice(fromPrefix.length));
          else newFolders.add(f);
        }
        state.folders = newFolders;
      },
    },
  } as unknown as Vault;
}

const KNOWN = ["archivist", "entity_type", "slug", "name", "compendium", "source"];

const READONLY_BODY = "\n\n```archivist\nslug: fireball\n```\n";

function fixtureState(): VaultState {
  return {
    files: {
      // Two readonly notes inside the SRD folder. Fireball is user-modified
      // (extra frontmatter key); Magic Missile is untouched.
      "Compendium/SRD/Spells/Fireball.md":
        `---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD\nsource: SRD\ntags: [magic]\n---${READONLY_BODY}`,
      "Compendium/SRD/Spells/Magic Missile.md":
        `---\narchivist: true\nentity_type: spell\nslug: magic-missile\nname: Magic Missile\ncompendium: SRD\nsource: SRD\n---${READONLY_BODY}`,
      // A user note with an unqualified wikilink.
      "Notes/Session1.md": "I cast [[fireball]] at the goblin.",
    },
    folders: new Set([
      "Compendium",
      "Compendium/SRD",
      "Compendium/SRD/Spells",
      "Notes",
    ]),
  };
}

describe("runMigration", () => {
  it("end-to-end: detects modifications, backs up, renames, rewrites, qualifies", async () => {
    const state = fixtureState();
    const vault = makeVault(state);
    const slugMap = new Map<string, string>([["fireball", "Compendium/SRD 5e/Spells/Fireball"]]);
    const result = await runMigration({
      vault,
      oldFolder: "Compendium/SRD",
      newFolder: "Compendium/SRD 5e",
      backupRoot: "Compendium/SRD.backup.20260429",
      knownFrontmatterKeys: KNOWN,
      frontmatterTransform: fm => ({ ...fm, compendium: "SRD 5e" }),
      slugMap,
      vaultRoot: "",
    });

    expect(result.modifiedFilesBackedUp).toBe(1);
    expect(result.folderRenamed).toBe("renamed");
    expect(result.frontmatterRewrites).toBe(2);
    expect(result.wikilinksRewritten).toBe(1);

    // Backup created.
    expect(state.files["Compendium/SRD.backup.20260429/Spells/Fireball.md"]).toContain("tags:");
    // Folder renamed.
    expect(state.files["Compendium/SRD 5e/Spells/Fireball.md"]).toBeDefined();
    expect(state.files["Compendium/SRD/Spells/Fireball.md"]).toBeUndefined();
    // Frontmatter rewritten in new folder.
    expect(state.files["Compendium/SRD 5e/Spells/Fireball.md"]).toContain("compendium: SRD 5e");
    expect(state.files["Compendium/SRD 5e/Spells/Magic Missile.md"]).toContain("compendium: SRD 5e");
    // Wikilink qualified.
    expect(state.files["Notes/Session1.md"]).toBe(
      "I cast [[Compendium/SRD 5e/Spells/Fireball|fireball]] at the goblin.",
    );
  });

  it("idempotent: a second migration is a series of noops", async () => {
    const state = fixtureState();
    const vault = makeVault(state);
    const slugMap = new Map<string, string>([["fireball", "Compendium/SRD 5e/Spells/Fireball"]]);
    const opts = {
      vault,
      oldFolder: "Compendium/SRD",
      newFolder: "Compendium/SRD 5e",
      backupRoot: "Compendium/SRD.backup.20260429",
      knownFrontmatterKeys: KNOWN,
      frontmatterTransform: (fm: Record<string, unknown>) => ({ ...fm, compendium: "SRD 5e" }),
      slugMap,
      vaultRoot: "",
    };

    await runMigration(opts);
    const second = await runMigration(opts);
    expect(second.modifiedFilesBackedUp).toBe(0);
    expect(second.folderRenamed).toBe("noop");
    expect(second.frontmatterRewrites).toBe(0);
    expect(second.wikilinksRewritten).toBe(0);
  });
});
