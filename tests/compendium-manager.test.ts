import { describe, it, expect, beforeEach, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import {
  Compendium,
  parseCompendiumMetadata,
  generateCompendiumMetadata,
  updateCompendiumFrontmatter,
  CompendiumManager,
  buildHomebrewSlug,
} from "../packages/obsidian/src/shared/entities/compendium-manager";
import { EntityRegistry } from "@core/entity-registry";

// ---------------------------------------------------------------------------
// parseCompendiumMetadata
// ---------------------------------------------------------------------------
describe("parseCompendiumMetadata", () => {
  it("parses valid _compendium.md with all fields", () => {
    const content = `---
archivist_compendium: true
name: SRD
description: System Reference Document
readonly: true
homebrew: false
---

# SRD
`;
    const result = parseCompendiumMetadata(content, "Compendium/SRD");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("SRD");
    expect(result!.description).toBe("System Reference Document");
    expect(result!.readonly).toBe(true);
    expect(result!.homebrew).toBe(false);
    expect(result!.folderPath).toBe("Compendium/SRD");
  });

  it("returns null for non-compendium files", () => {
    const content = `---
title: Just a note
---

# Not a compendium
`;
    expect(parseCompendiumMetadata(content, "Notes")).toBeNull();
  });

  it("returns null for content without frontmatter", () => {
    const content = "# Just a heading\nSome text.";
    expect(parseCompendiumMetadata(content, "Notes")).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(parseCompendiumMetadata("", "Notes")).toBeNull();
  });

  it("returns null when archivist_compendium is false", () => {
    const content = `---
archivist_compendium: false
name: Fake
description: Not real
---

# Fake
`;
    expect(parseCompendiumMetadata(content, "Notes")).toBeNull();
  });

  it("defaults readonly to false when omitted", () => {
    const content = `---
archivist_compendium: true
name: My Homebrew
description: Custom creatures
homebrew: true
---

# My Homebrew
`;
    const result = parseCompendiumMetadata(content, "Compendium/Homebrew");
    expect(result).not.toBeNull();
    expect(result!.readonly).toBe(false);
  });

  it("defaults homebrew to true when omitted", () => {
    const content = `---
archivist_compendium: true
name: My Homebrew
description: Custom creatures
---

# My Homebrew
`;
    const result = parseCompendiumMetadata(content, "Compendium/Homebrew");
    expect(result).not.toBeNull();
    expect(result!.homebrew).toBe(true);
  });

  it("returns null when name is missing", () => {
    const content = `---
archivist_compendium: true
description: No name field
---

# Oops
`;
    expect(parseCompendiumMetadata(content, "Compendium/Bad")).toBeNull();
  });

  it("defaults description to empty string when omitted", () => {
    const content = `---
archivist_compendium: true
name: Minimal
---

# Minimal
`;
    const result = parseCompendiumMetadata(content, "Compendium/Minimal");
    expect(result).not.toBeNull();
    expect(result!.description).toBe("");
  });
});

// ---------------------------------------------------------------------------
// generateCompendiumMetadata
// ---------------------------------------------------------------------------
describe("generateCompendiumMetadata", () => {
  it("generates valid markdown with all properties", () => {
    const comp: Compendium = {
      name: "SRD",
      description: "System Reference Document",
      readonly: true,
      homebrew: false,
      folderPath: "Compendium/SRD",
    };
    const md = generateCompendiumMetadata(comp);
    expect(md).toContain("archivist_compendium: true");
    expect(md).toContain("name: SRD");
    expect(md).toContain("description: System Reference Document");
    expect(md).toContain("readonly: true");
    expect(md).toContain("homebrew: false");
    expect(md).toContain("# SRD");
  });

  it("starts and ends with frontmatter delimiters", () => {
    const comp: Compendium = {
      name: "Test",
      description: "Test compendium",
      readonly: false,
      homebrew: true,
      folderPath: "Compendium/Test",
    };
    const md = generateCompendiumMetadata(comp);
    expect(md.startsWith("---\n")).toBe(true);
    const markers = md.split("\n").filter((line) => line.trim() === "---");
    expect(markers.length).toBe(2);
  });

  it("roundtrips through generate and parse", () => {
    const original: Compendium = {
      name: "Homebrew",
      description: "My custom content",
      readonly: false,
      homebrew: true,
      folderPath: "Compendium/Homebrew",
    };
    const md = generateCompendiumMetadata(original);
    const parsed = parseCompendiumMetadata(md, original.folderPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe(original.name);
    expect(parsed!.description).toBe(original.description);
    expect(parsed!.readonly).toBe(original.readonly);
    expect(parsed!.homebrew).toBe(original.homebrew);
    expect(parsed!.folderPath).toBe(original.folderPath);
  });
});

// ---------------------------------------------------------------------------
// updateCompendiumFrontmatter (lossless single-key merge)
// ---------------------------------------------------------------------------
describe("updateCompendiumFrontmatter", () => {
  // Mirrors the real bundle-shipped SRD file: carries keys the Compendium
  // model does not know about (edition, version stamp, import timestamp).
  const srdContent = `---
archivist_compendium: true
name: SRD 5e
description: D&D 5e System Reference Document 5.1
edition: '2014'
readonly: true
homebrew: false
archivist_compendium_version: 0.2.0
archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'
---

# SRD 5e
`;

  it("updates only the given key, preserving every unknown frontmatter key", () => {
    const result = updateCompendiumFrontmatter(srdContent, { readonly: false });
    expect(result).not.toBeNull();
    expect(result!).toContain("readonly: false");
    expect(result!).toContain("edition: '2014'");
    expect(result!).toContain("archivist_compendium_version: 0.2.0");
    expect(result!).toContain("archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'");
    expect(result!).toContain("archivist_compendium: true");
    expect(result!).toContain("name: SRD 5e");
    expect(result!).toContain("homebrew: false");
  });

  it("preserves key order and the body below the frontmatter", () => {
    const result = updateCompendiumFrontmatter(srdContent, { readonly: false })!;
    // Order preserved: edition before readonly, version stamp after homebrew
    const editionIdx = result.indexOf("edition:");
    const readonlyIdx = result.indexOf("readonly:");
    const homebrewIdx = result.indexOf("homebrew:");
    const versionIdx = result.indexOf("archivist_compendium_version:");
    expect(editionIdx).toBeGreaterThan(-1);
    expect(editionIdx).toBeLessThan(readonlyIdx);
    expect(readonlyIdx).toBeLessThan(homebrewIdx);
    expect(homebrewIdx).toBeLessThan(versionIdx);
    // Body verbatim
    expect(result.endsWith("---\n\n# SRD 5e\n")).toBe(true);
  });

  it("changing nothing but the target key round-trips the file byte-identically", () => {
    // readonly is already true — writing the same value must reproduce the file
    const result = updateCompendiumFrontmatter(srdContent, { readonly: true });
    expect(result).toBe(srdContent);
  });

  it("inserts a NEW key next to readonly rather than at the end", () => {
    const result = updateCompendiumFrontmatter(srdContent, { hidden: true })!;
    const readonlyIdx = result.indexOf("readonly: true");
    const hiddenIdx = result.indexOf("hidden: true");
    const homebrewIdx = result.indexOf("homebrew: false");
    expect(readonlyIdx).toBeLessThan(hiddenIdx);
    expect(hiddenIdx).toBeLessThan(homebrewIdx);
    // Everything else still intact
    expect(result).toContain("archivist_compendium_version: 0.2.0");
    expect(result.endsWith("# SRD 5e\n")).toBe(true);
  });

  it("appends a new key at the end when no readonly key exists", () => {
    const minimal = `---
archivist_compendium: true
name: Minimal
---

# Minimal
`;
    const result = updateCompendiumFrontmatter(minimal, { hidden: true })!;
    expect(result).toContain("hidden: true");
    expect(result.indexOf("name: Minimal")).toBeLessThan(result.indexOf("hidden: true"));
    expect(result.endsWith("# Minimal\n")).toBe(true);
  });

  it("preserves a multi-line body with its own --- horizontal rules", () => {
    const content = `---
archivist_compendium: true
name: Notes
readonly: false
---

# Notes

Some prose the user wrote.

---

More prose after a horizontal rule.
`;
    const result = updateCompendiumFrontmatter(content, { readonly: true })!;
    expect(result).toContain("readonly: true");
    expect(result).toContain("Some prose the user wrote.");
    expect(result).toContain("More prose after a horizontal rule.");
  });

  it("returns null for empty / non-frontmatter / malformed content", () => {
    expect(updateCompendiumFrontmatter("", { readonly: true })).toBeNull();
    expect(updateCompendiumFrontmatter("# No frontmatter", { readonly: true })).toBeNull();
    expect(updateCompendiumFrontmatter("---\nname: [unclosed\n---\n", { readonly: true })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildHomebrewSlug
// ---------------------------------------------------------------------------
describe("buildHomebrewSlug", () => {
  it("saves a new homebrew entity with a 3-part type-namespaced slug", () => {
    const slug = buildHomebrewSlug({
      compendium: "Me",
      entityType: "item",
      name: "Cloak of Test",
    });
    expect(slug).toBe("me_item_cloak-of-test");
  });

  it("normalizes the legacy 'magic-item' alias to 'item'", () => {
    const slug = buildHomebrewSlug({
      compendium: "Me",
      entityType: "magic-item",
      name: "Cloak of Test",
    });
    expect(slug).toBe("me_item_cloak-of-test");
  });

  it("preserves hyphenated canonical types like 'optional-feature'", () => {
    const slug = buildHomebrewSlug({
      compendium: "Me",
      entityType: "optional-feature",
      name: "Fighting Style",
    });
    expect(slug).toBe("me_optional-feature_fighting-style");
  });

  it("slugifies a multi-word compendium name into the prefix", () => {
    const slug = buildHomebrewSlug({
      compendium: "My Homebrew",
      entityType: "monster",
      name: "Shadow Goblin",
    });
    expect(slug).toBe("my-homebrew_monster_shadow-goblin");
  });
});

// ---------------------------------------------------------------------------
// CompendiumManager
// ---------------------------------------------------------------------------
describe("CompendiumManager", () => {
  let registry: EntityRegistry;
  let vault: any;
  let manager: CompendiumManager;

  // -------------------------------------------------------------------------
  // Vault mock helpers
  // -------------------------------------------------------------------------
  function makeFile(name: string, path: string, content: string) {
    const file = new TFile();
    file.name = name;
    file.path = path;
    file.extension = "md";
    file._content = content;
    return file;
  }

  function makeFolder(name: string, path: string, children: any[]) {
    const folder = new TFolder();
    folder.name = name;
    folder.path = path;
    folder.children = children;
    return folder;
  }

  beforeEach(() => {
    registry = new EntityRegistry();

    vault = {
      getAbstractFileByPath: vi.fn(),
      cachedRead: vi.fn(),
      create: vi.fn(),
      modify: vi.fn(),
      createFolder: vi.fn(),
    };

    const fileManager = { trashFile: vi.fn() };

    manager = new CompendiumManager(registry, vault, fileManager, "Compendium");
  });

  // -------------------------------------------------------------------------
  // addCompendium / getAll / getWritable / getByName
  // -------------------------------------------------------------------------
  describe("in-memory operations", () => {
    it("addCompendium and getAll", () => {
      const comp: Compendium = {
        name: "SRD",
        description: "System Reference Document",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD",
      };
      manager.addCompendium(comp);
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].name).toBe("SRD");
    });

    it("getWritable returns only non-readonly compendiums", () => {
      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });
      manager.addCompendium({
        name: "Homebrew",
        description: "Custom",
        readonly: false,
        homebrew: true,
        folderPath: "Compendium/Homebrew",
      });
      const writable = manager.getWritable();
      expect(writable).toHaveLength(1);
      expect(writable[0].name).toBe("Homebrew");
    });

    it("getByName returns the matching compendium", () => {
      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });
      expect(manager.getByName("SRD")).toBeDefined();
      expect(manager.getByName("SRD")!.readonly).toBe(true);
    });

    it("getByName returns undefined for unknown", () => {
      expect(manager.getByName("Unknown")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // discover()
  // -------------------------------------------------------------------------
  describe("discover", () => {
    it("discovers compendiums from vault folders", async () => {
      const srdMeta = `---
archivist_compendium: true
name: SRD
description: System Reference Document
readonly: true
homebrew: false
---

# SRD
`;
      const compendiumFile = makeFile("_compendium.md", "Compendium/SRD/_compendium.md", srdMeta);
      const srdFolder = makeFolder("SRD", "Compendium/SRD", [compendiumFile]);
      const rootFolder = makeFolder("Compendium", "Compendium", [srdFolder]);

      vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Compendium") return rootFolder;
        if (path === "Compendium/SRD/_compendium.md") return compendiumFile;
        return null;
      });
      vault.cachedRead.mockImplementation((file: any) => Promise.resolve(file._content));

      await manager.discover();

      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getByName("SRD")).toBeDefined();
      expect(manager.getByName("SRD")!.readonly).toBe(true);
    });

    it("ignores folders without _compendium.md", async () => {
      const randomFolder = makeFolder("Random", "Compendium/Random", []);
      const rootFolder = makeFolder("Compendium", "Compendium", [randomFolder]);

      vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Compendium") return rootFolder;
        if (path === "Compendium/Random/_compendium.md") return null;
        return null;
      });

      await manager.discover();

      expect(manager.getAll()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // loadAllEntities()
  // -------------------------------------------------------------------------
  describe("loadAllEntities", () => {
    it("loads entities from all compendiums and registers them", async () => {
      // Setup a compendium
      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });

      // Create an entity file
      const entityContent = `---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
compendium: SRD
---

\`\`\`monster
name: Goblin
size: Small
type: humanoid
\`\`\`
`;
      const entityFile = makeFile("Goblin.md", "Compendium/SRD/Monsters/Goblin.md", entityContent);
      const monstersFolder = makeFolder("Monsters", "Compendium/SRD/Monsters", [entityFile]);
      const compMeta = makeFile("_compendium.md", "Compendium/SRD/_compendium.md", "");
      const srdFolder = makeFolder("SRD", "Compendium/SRD", [compMeta, monstersFolder]);

      vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Compendium/SRD") return srdFolder;
        return null;
      });
      vault.cachedRead.mockImplementation((file: any) => Promise.resolve(file._content));

      const count = await manager.loadAllEntities();

      expect(count).toBe(1);
      expect(registry.count()).toBe(1);
      const entity = registry.getBySlug("goblin");
      expect(entity).toBeDefined();
      expect(entity!.compendium).toBe("SRD");
      expect(entity!.readonly).toBe(true);
      expect(entity!.homebrew).toBe(false);
    });

    it("skips _compendium.md files", async () => {
      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });

      const compMeta = makeFile("_compendium.md", "Compendium/SRD/_compendium.md", "meta");
      const srdFolder = makeFolder("SRD", "Compendium/SRD", [compMeta]);

      vault.getAbstractFileByPath.mockImplementation((path: string) => {
        if (path === "Compendium/SRD") return srdFolder;
        return null;
      });
      vault.cachedRead.mockImplementation(() => Promise.resolve("meta"));

      const count = await manager.loadAllEntities();
      expect(count).toBe(0);
    });

    it("returns 0 when no compendiums exist", async () => {
      const count = await manager.loadAllEntities();
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe("create", () => {
    it("creates folder and _compendium.md file", async () => {
      vault.createFolder.mockResolvedValue(undefined);
      vault.create.mockResolvedValue({});

      const comp = await manager.create("My Homebrew", "Custom monsters", true, false);

      expect(comp.name).toBe("My Homebrew");
      expect(comp.description).toBe("Custom monsters");
      expect(comp.homebrew).toBe(true);
      expect(comp.readonly).toBe(false);
      expect(comp.folderPath).toBe("Compendium/My Homebrew");

      expect(vault.createFolder).toHaveBeenCalledWith("Compendium/My Homebrew");
      expect(vault.create).toHaveBeenCalledWith(
        "Compendium/My Homebrew/_compendium.md",
        expect.any(String),
      );

      // Should also be in the manager
      expect(manager.getByName("My Homebrew")).toBeDefined();
    });

    it("handles folder already existing (createFolder throws)", async () => {
      vault.createFolder.mockRejectedValue(new Error("Folder already exists"));
      vault.create.mockResolvedValue({});

      const comp = await manager.create("Existing", "Already there", true, false);
      expect(comp.name).toBe("Existing");
    });
  });

  // -------------------------------------------------------------------------
  // setReadonly()
  // -------------------------------------------------------------------------
  describe("setReadonly", () => {
    it("updates _compendium.md with new readonly value", async () => {
      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: false,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });

      // Empty/corrupt existing content: merge is impossible, so the writer
      // falls back to full regeneration from the in-memory model.
      const compFile = makeFile("_compendium.md", "Compendium/SRD/_compendium.md", "");
      vault.getAbstractFileByPath.mockReturnValue(compFile);
      vault.cachedRead.mockImplementation((file: any) => Promise.resolve(file._content));
      vault.modify.mockResolvedValue(undefined);

      await manager.setReadonly("SRD", true);

      expect(manager.getByName("SRD")!.readonly).toBe(true);
      expect(vault.modify).toHaveBeenCalledWith(compFile, expect.any(String));
      const written = vault.modify.mock.calls[0][1] as string;
      expect(written).toContain("readonly: true");
      expect(written).toContain("name: SRD");
    });

    it("preserves frontmatter keys it does not own (regression: bundle version stamp)", async () => {
      // The bundle-shipped SRD `_compendium.md` carries edition, a version
      // stamp, and an import timestamp. Toggling read-only must NOT strip
      // them: `archivist_compendium_version` gates bootstrap re-copy, so
      // losing it re-installs the whole bundle on next load.
      manager.addCompendium({
        name: "SRD 5e",
        description: "D&D 5e System Reference Document 5.1",
        readonly: true,
        homebrew: false,
        folderPath: "Compendium/SRD 5e",
      });

      const bundleContent = `---
archivist_compendium: true
name: SRD 5e
description: D&D 5e System Reference Document 5.1
edition: '2014'
readonly: true
homebrew: false
archivist_compendium_version: 0.2.0
archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'
---

# SRD 5e
`;
      const compFile = makeFile("_compendium.md", "Compendium/SRD 5e/_compendium.md", bundleContent);
      vault.getAbstractFileByPath.mockReturnValue(compFile);
      vault.cachedRead.mockImplementation((file: any) => Promise.resolve(file._content));
      vault.modify.mockResolvedValue(undefined);

      await manager.setReadonly("SRD 5e", false);

      const written = vault.modify.mock.calls[0][1] as string;
      expect(written).toContain("readonly: false");
      expect(written).toContain("edition: '2014'");
      expect(written).toContain("archivist_compendium_version: 0.2.0");
      expect(written).toContain("archivist_compendium_imported_at: '2026-07-21T08:14:58.947Z'");
      expect(written).toContain("# SRD 5e");
    });

    it("throws for unknown compendium", async () => {
      await expect(manager.setReadonly("Unknown", true)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // saveEntity()
  // -------------------------------------------------------------------------
  describe("saveEntity", () => {
    it("creates entity file and registers in registry", async () => {
      manager.addCompendium({
        name: "Homebrew",
        description: "Custom",
        readonly: false,
        homebrew: true,
        folderPath: "Compendium/Homebrew",
      });

      vault.createFolder.mockResolvedValue(undefined);
      vault.create.mockResolvedValue({});

      const result = await manager.saveEntity("Homebrew", "monster", {
        name: "Shadow Goblin",
        size: "Small",
        type: "humanoid",
      });

      expect(result.name).toBe("Shadow Goblin");
      expect(result.entityType).toBe("monster");
      expect(result.compendium).toBe("Homebrew");
      expect(result.readonly).toBe(false);
      expect(result.homebrew).toBe(true);
      expect(result.slug).toBe("homebrew_monster_shadow-goblin");

      // Should be in the registry
      expect(registry.getBySlug("homebrew_monster_shadow-goblin")).toBeDefined();

      // Should have created the file
      expect(vault.create).toHaveBeenCalledWith(
        expect.stringContaining("Compendium/Homebrew/Monsters/"),
        expect.any(String),
      );
    });

    it("throws for unknown compendium", async () => {
      await expect(
        manager.saveEntity("Unknown", "monster", { name: "Test" }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // updateEntity()
  // -------------------------------------------------------------------------
  describe("updateEntity", () => {
    it("updates entity file and re-registers", async () => {
      // Pre-register an entity
      registry.register({
        slug: "goblin",
        name: "Goblin",
        entityType: "monster",
        filePath: "Compendium/SRD/Monsters/Goblin.md",
        data: { name: "Goblin", size: "Small" },
        compendium: "SRD",
        readonly: false,
        homebrew: false,
      });

      manager.addCompendium({
        name: "SRD",
        description: "Official",
        readonly: false,
        homebrew: false,
        folderPath: "Compendium/SRD",
      });

      const entityFile = makeFile("Goblin.md", "Compendium/SRD/Monsters/Goblin.md", "");
      vault.getAbstractFileByPath.mockReturnValue(entityFile);
      vault.modify.mockResolvedValue(undefined);

      await manager.updateEntity("goblin", {
        name: "Goblin",
        size: "Small",
        hp: 7,
      });

      expect(vault.modify).toHaveBeenCalledWith(entityFile, expect.any(String));

      // Registry should be updated
      const updated = registry.getBySlug("goblin");
      expect(updated).toBeDefined();
      expect(updated!.data).toEqual({ name: "Goblin", size: "Small", hp: 7 });
    });

    it("throws for unknown slug", async () => {
      await expect(manager.updateEntity("nonexistent", { name: "X" })).rejects.toThrow();
    });
  });
});
