import { describe, it, expect } from "vitest";
import { detectModifiedFiles } from "../../src/shared/compendium-init/modification-detector";
import type { Vault } from "obsidian";

interface VaultFixture {
  files: Record<string, string>;
}

function makeVault(fixture: VaultFixture): Vault {
  const exists = async (p: string): Promise<boolean> => {
    if (fixture.files[p] !== undefined) return true;
    const prefix = p.endsWith("/") ? p : `${p}/`;
    return Object.keys(fixture.files).some(f => f.startsWith(prefix));
  };
  const list = async (p: string): Promise<{ files: string[]; folders: string[] }> => {
    const prefix = p.endsWith("/") ? p : `${p}/`;
    const files = new Set<string>();
    const folders = new Set<string>();
    for (const path of Object.keys(fixture.files)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        files.add(path);
      } else {
        folders.add(prefix + rest.slice(0, slash));
      }
    }
    return { files: Array.from(files), folders: Array.from(folders) };
  };
  const read = async (p: string): Promise<string> => {
    const content = fixture.files[p];
    if (content === undefined) throw new Error(`not found: ${p}`);
    return content;
  };
  return {
    adapter: { exists, list, read },
  } as unknown as Vault;
}

const KNOWN = [
  "archivist",
  "entity_type",
  "slug",
  "name",
  "compendium",
  "source",
  "archivist_compendium_imported_at",
];

const UNMODIFIED_BODY = "\n\n```archivist\nslug: fireball\n```\n";

describe("detectModifiedFiles", () => {
  it("returns empty list when notes are unmodified", async () => {
    const vault = makeVault({
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          `---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD\nsource: SRD\n---\n${UNMODIFIED_BODY}`,
        "Compendium/SRD/Spells/Magic Missile.md":
          `---\narchivist: true\nentity_type: spell\nslug: magic-missile\nname: Magic Missile\ncompendium: SRD\nsource: SRD\n---\n${UNMODIFIED_BODY}`,
      },
    });
    const result = await detectModifiedFiles({
      vault,
      folder: "Compendium/SRD",
      knownFrontmatterKeys: KNOWN,
    });
    expect(result).toEqual([]);
  });

  it("flags files with unknown frontmatter keys (user-added properties)", async () => {
    const vault = makeVault({
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          `---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD\nsource: SRD\ntags: [magic]\n---\n${UNMODIFIED_BODY}`,
        "Compendium/SRD/Spells/Magic Missile.md":
          `---\narchivist: true\nentity_type: spell\nslug: magic-missile\nname: Magic Missile\ncompendium: SRD\nsource: SRD\n---\n${UNMODIFIED_BODY}`,
      },
    });
    const result = await detectModifiedFiles({
      vault,
      folder: "Compendium/SRD",
      knownFrontmatterKeys: KNOWN,
    });
    expect(result).toEqual(["Compendium/SRD/Spells/Fireball.md"]);
  });

  it("flags files with prose outside the codeblock", async () => {
    const vault = makeVault({
      files: {
        "Compendium/SRD/Spells/Fireball.md":
          `---\narchivist: true\nentity_type: spell\nslug: fireball\nname: Fireball\ncompendium: SRD\nsource: SRD\n---\n\nMy own notes about Fireball.\n\n\`\`\`archivist\nslug: fireball\n\`\`\`\n`,
        "Compendium/SRD/Spells/Magic Missile.md":
          `---\narchivist: true\nentity_type: spell\nslug: magic-missile\nname: Magic Missile\ncompendium: SRD\nsource: SRD\n---\n${UNMODIFIED_BODY}`,
      },
    });
    const result = await detectModifiedFiles({
      vault,
      folder: "Compendium/SRD",
      knownFrontmatterKeys: KNOWN,
    });
    expect(result).toEqual(["Compendium/SRD/Spells/Fireball.md"]);
  });
});
