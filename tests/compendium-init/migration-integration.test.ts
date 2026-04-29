import { describe, it, expect } from "vitest";
import { runMigration } from "../../src/shared/compendium-init/migration";
import type { Vault } from "obsidian";

interface FakeVault {
  files: Map<string, string>;
  folders: Set<string>;
  adapter: {
    exists: (p: string) => Promise<boolean>;
    list: (p: string) => Promise<{ files: string[]; folders: string[] }>;
    read: (p: string) => Promise<string>;
    write: (p: string, c: string) => Promise<void>;
    mkdir: (p: string) => Promise<void>;
    rename: (from: string, to: string) => Promise<void>;
  };
}

function makeVault(initial: Record<string, string>, folders: string[] = []): FakeVault {
  const files = new Map(Object.entries(initial));
  const folderSet = new Set([...folders, ...derivedFolders(Object.keys(initial))]);
  return {
    files,
    folders: folderSet,
    adapter: {
      exists: async (p) => p === "" || files.has(p) || folderSet.has(p),
      list: async (p) => {
        const childFiles: string[] = [];
        const childFolders: string[] = [];
        const prefix = p === "" ? "" : p + "/";
        const stripLen = prefix.length;
        for (const f of files.keys()) {
          if (prefix === "" || f.startsWith(prefix)) {
            const rest = f.slice(stripLen);
            if (rest && !rest.includes("/")) childFiles.push(f);
          }
        }
        for (const fd of folderSet) {
          if (fd === p) continue;
          if (prefix === "" || fd.startsWith(prefix)) {
            const rest = fd.slice(stripLen);
            if (rest && !rest.includes("/")) childFolders.push(fd);
          }
        }
        return { files: childFiles, folders: childFolders };
      },
      read: async (p) => files.get(p) ?? "",
      write: async (p, c) => { files.set(p, c); },
      mkdir: async (p) => { folderSet.add(p); },
      rename: async (from, to) => {
        const updated = new Map<string, string>();
        for (const [k, v] of files.entries()) {
          if (k === from || k.startsWith(from + "/")) {
            updated.set(to + k.slice(from.length), v);
          } else {
            updated.set(k, v);
          }
        }
        files.clear();
        for (const [k, v] of updated) files.set(k, v);
        const newFolders = new Set<string>();
        for (const fd of folderSet) {
          if (fd === from || fd.startsWith(from + "/")) newFolders.add(to + fd.slice(from.length));
          else newFolders.add(fd);
        }
        folderSet.clear();
        for (const fd of newFolders) folderSet.add(fd);
      },
    },
  };
}

function derivedFolders(paths: string[]): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    parts.pop();
    for (let i = 1; i <= parts.length; i++) {
      out.add(parts.slice(0, i).join("/"));
    }
  }
  return Array.from(out);
}

describe("migration integration", () => {
  it("end-to-end: backup → rename → frontmatter rewrite → wikilink qualify", async () => {
    const vault = makeVault({
      "Compendium/SRD/Spells/Fireball.md": "---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD\nsource: SRD 5.1\narchivist_compendium_imported_at: 2025-01-01T00:00:00.000Z\n---\n\n```spell\nslug: fireball\nname: Fireball\n```\n",
      "Compendium/SRD/Spells/MagicMissile.md": "---\narchivist: true\nentity_type: spell\nslug: magic-missile\nname: Magic Missile\ncompendium: SRD\nsource: SRD 5.1\narchivist_compendium_imported_at: 2025-01-01T00:00:00.000Z\n---\n\n```spell\nslug: magic-missile\nname: Magic Missile\n```\n\nUser added their own notes here.\n",  // modified — body has prose
      "PCs/Bobblehead.md": "---\nname: Bobblehead\n---\n\nBobblehead loves [[fireball]] and [[magic-missile|MM]].\n",
    });

    const slugMap = new Map([
      ["fireball", "Compendium/SRD 5e/Spells/Fireball"],
      ["magic-missile", "Compendium/SRD 5e/Spells/Magic Missile"],
    ]);

    const result = await runMigration({
      vault: vault as unknown as Vault,
      oldFolder: "Compendium/SRD",
      newFolder: "Compendium/SRD 5e",
      backupRoot: "Compendium/SRD.backup.test",
      knownFrontmatterKeys: ["archivist", "entity_type", "slug", "name", "compendium", "source", "archivist_compendium_imported_at"],
      frontmatterTransform: (fm) => ({ ...fm, compendium: "SRD 5e" }),
      slugMap,
      vaultRoot: "",
    });

    expect(result.modifiedFilesBackedUp).toBe(1);  // MagicMissile body had prose
    expect(result.folderRenamed).toBe("renamed");
    expect(result.frontmatterRewrites).toBeGreaterThan(0);
    expect(result.wikilinksRewritten).toBe(2);

    // Folder renamed
    expect(vault.files.has("Compendium/SRD 5e/Spells/Fireball.md")).toBe(true);
    expect(vault.files.has("Compendium/SRD/Spells/Fireball.md")).toBe(false);

    // Frontmatter rewritten
    const fireballContent = vault.files.get("Compendium/SRD 5e/Spells/Fireball.md")!;
    expect(fireballContent).toContain("compendium: SRD 5e");

    // Wikilinks qualified in PC note
    const bobble = vault.files.get("PCs/Bobblehead.md")!;
    expect(bobble).toContain("[[Compendium/SRD 5e/Spells/Fireball|fireball]]");
    expect(bobble).toContain("[[Compendium/SRD 5e/Spells/Magic Missile|MM]]");

    // Backup created for the modified MagicMissile
    expect(vault.files.has("Compendium/SRD.backup.test/Spells/MagicMissile.md")).toBe(true);
  });

  it("idempotent: running migration twice on already-migrated vault is a noop", async () => {
    const vault = makeVault({
      "Compendium/SRD 5e/Spells/Fireball.md": "---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD 5e\nsource: SRD 5.1\narchivist_compendium_imported_at: 2025-01-01T00:00:00.000Z\n---\n\n```spell\nslug: fireball\nname: Fireball\n```\n",
    });

    const result = await runMigration({
      vault: vault as unknown as Vault,
      oldFolder: "Compendium/SRD",
      newFolder: "Compendium/SRD 5e",
      backupRoot: "Compendium/SRD.backup.test",
      knownFrontmatterKeys: ["archivist", "entity_type", "slug", "name", "compendium", "source", "archivist_compendium_imported_at"],
      frontmatterTransform: (fm) => fm,
      slugMap: new Map(),
      vaultRoot: "",
    });

    expect(result.folderRenamed).toBe("noop");
    expect(result.modifiedFilesBackedUp).toBe(0);
    expect(result.frontmatterRewrites).toBe(0);
  });
});
