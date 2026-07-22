import * as yaml from "js-yaml";
import {
  TFile,
  TFolder,
  type FileManager,
  type Vault,
  type TAbstractFile,
} from "obsidian";
import {
  EntityNote,
  generateEntityMarkdown,
  parseEntityFile,
  TYPE_FOLDER_MAP,
  slugify,
  ensureUniqueSlug,
} from "./entity-vault-store";
import type { EntityRegistry, RegisteredEntity } from "@archivist-gg/core";

// ---------------------------------------------------------------------------
// Compendium interface
// ---------------------------------------------------------------------------

export interface Compendium {
  name: string;
  description: string;
  readonly: boolean;
  homebrew: boolean;
  folderPath: string;
}

// ---------------------------------------------------------------------------
// buildHomebrewSlug
// ---------------------------------------------------------------------------

/**
 * Mints the base slug for a newly saved homebrew entity, type-namespaced as
 * `<compendium-prefix>_<entity-type>_<name-slug>` (matching the SRD build-time
 * generator). The compendium prefix keeps slugs globally unique across
 * compendiums; the entity-type token disambiguates same-name entities of
 * different kinds (e.g. the Shield armor vs. the Shield spell). Callers must
 * still pass the result through `ensureUniqueSlug` to resolve in-compendium
 * same-type duplicates.
 *
 * All live call sites pass a singular canonical presenter `type`
 * (armor|weapon|item|spell|monster|class|subclass|background|race|feat|
 * optional-feature|condition). Defensively, the one legacy alias "magic-item"
 * is normalized to "item", then the token is slugified so it is always
 * file-safe (slugify preserves hyphens, so "optional-feature" is unchanged).
 */
export function buildHomebrewSlug(args: {
  compendium: string;
  entityType: string;
  name: string;
}): string {
  const normalizedType =
    args.entityType === "magic-item" ? "item" : args.entityType;
  const type = slugify(normalizedType);
  return `${slugify(args.compendium)}_${type}_${slugify(args.name)}`;
}

// ---------------------------------------------------------------------------
// parseCompendiumMetadata
// ---------------------------------------------------------------------------

/**
 * Parses the content of a `_compendium.md` file and returns a Compendium
 * object, or null if the content is not a valid compendium metadata file.
 */
export function parseCompendiumMetadata(
  content: string,
  folderPath: string,
): Compendium | null {
  if (!content || !content.startsWith("---\n")) return null;

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return null;

  const yamlBlock = content.substring(4, endIndex);

  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(yamlBlock) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.archivist_compendium !== true) return null;

  const name = parsed.name;
  if (typeof name !== "string") return null;

  const description =
    typeof parsed.description === "string" ? parsed.description : "";
  const readonly =
    typeof parsed.readonly === "boolean" ? parsed.readonly : false;
  const homebrew =
    typeof parsed.homebrew === "boolean" ? parsed.homebrew : true;

  return {
    name,
    description,
    readonly,
    homebrew,
    folderPath,
  };
}

// ---------------------------------------------------------------------------
// generateCompendiumMetadata
// ---------------------------------------------------------------------------

/**
 * Generates the markdown content for a `_compendium.md` file from a
 * Compendium object.
 */
export function generateCompendiumMetadata(comp: Compendium): string {
  const frontmatter: Record<string, unknown> = {
    archivist_compendium: true,
    name: comp.name,
    description: comp.description,
    readonly: comp.readonly,
    homebrew: comp.homebrew,
  };
  const fm = yaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
  return `---\n${fm}---\n\n# ${comp.name}\n`;
}

// ---------------------------------------------------------------------------
// updateCompendiumFrontmatter
// ---------------------------------------------------------------------------

/**
 * Lossless key-level frontmatter update for `_compendium.md` content.
 *
 * Parses the existing frontmatter, sets/updates ONLY the given keys, and
 * re-serializes preserving every other key (in original order) AND the body
 * below the frontmatter verbatim. This is the required write path for
 * mutating existing compendium metadata: the bundle-shipped files carry keys
 * the Compendium model does not own (`edition`,
 * `archivist_compendium_version`, `archivist_compendium_imported_at`), and
 * `archivist_compendium_version` gates bootstrap re-copy, so a regenerating
 * writer would trigger a full bundle re-install on the next load.
 *
 * New keys (not present in the file) are inserted directly after `readonly`
 * when that key exists, else appended at the end of the frontmatter.
 *
 * Returns null when the content has no parseable frontmatter (caller decides
 * the fallback). `generateCompendiumMetadata` remains ONLY for creating
 * brand-new compendium files.
 */
export function updateCompendiumFrontmatter(
  content: string,
  updates: Record<string, unknown>,
): string | null {
  if (!content || !content.startsWith("---\n")) return null;

  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return null;

  const yamlBlock = content.substring(4, endIndex);

  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(yamlBlock) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    merged[key] = key in updates ? updates[key] : value;
    if (key === "readonly") {
      for (const [uk, uv] of Object.entries(updates)) {
        if (!(uk in parsed)) merged[uk] = uv;
      }
    }
  }
  // New keys when no `readonly` anchor existed in the file
  for (const [uk, uv] of Object.entries(updates)) {
    if (!(uk in merged)) merged[uk] = uv;
  }

  const fm = yaml.dump(merged, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  // Body: everything from the newline that terminates the closing `---` line,
  // preserved verbatim (including that leading newline).
  const lineEnd = content.indexOf("\n", endIndex + 1);
  const body = lineEnd === -1 ? "\n" : content.substring(lineEnd);
  return `---\n${fm}---${body}`;
}

// ---------------------------------------------------------------------------
// collectMarkdownFiles (helper)
// ---------------------------------------------------------------------------

/**
 * Recursively collects all .md files from a folder and its subfolders.
 * Vault folders have a `children` array; files have a `name` property.
 */
function collectMarkdownFiles(folder: TAbstractFile | null | undefined): TFile[] {
  const files: TFile[] = [];
  if (!(folder instanceof TFolder)) return files;

  for (const child of folder.children) {
    if (child instanceof TFolder) {
      // It's a subfolder, recurse
      files.push(...collectMarkdownFiles(child));
    } else if (child instanceof TFile && child.name.endsWith(".md")) {
      files.push(child);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// CompendiumManager
// ---------------------------------------------------------------------------

/**
 * Central module for compendium-level operations. Owns a Map<string, Compendium>
 * keyed by compendium name for O(1) lookups.
 */
export class CompendiumManager {
  private compendiums = new Map<string, Compendium>();
  private registry: EntityRegistry;
  private vault: Vault;
  private fileManager: FileManager;
  private compendiumRoot: string;

  constructor(
    registry: EntityRegistry,
    vault: Vault,
    fileManager: FileManager,
    compendiumRoot: string,
  ) {
    this.registry = registry;
    this.vault = vault;
    this.fileManager = fileManager;
    this.compendiumRoot = compendiumRoot;
  }

  /** List all compendiums. */
  getAll(): Compendium[] {
    return Array.from(this.compendiums.values());
  }

  /** Only non-readonly compendiums. */
  getWritable(): Compendium[] {
    return this.getAll().filter((c) => !c.readonly);
  }

  /** Look up a specific compendium by name. */
  getByName(name: string): Compendium | undefined {
    return this.compendiums.get(name);
  }

  /** Add a compendium to the internal Map. */
  addCompendium(comp: Compendium): void {
    this.compendiums.set(comp.name, comp);
  }

  /**
   * Scan vault folders under compendiumRoot, read `_compendium.md` files,
   * and populate the internal Map.
   */
  async discover(): Promise<void> {
    const rootFolder = this.vault.getAbstractFileByPath(this.compendiumRoot);
    if (!(rootFolder instanceof TFolder)) return;

    for (const child of rootFolder.children) {
      // Only look at subfolders
      if (!(child instanceof TFolder)) continue;

      const metaPath = `${child.path}/_compendium.md`;
      const metaFile = this.vault.getAbstractFileByPath(metaPath);
      if (!(metaFile instanceof TFile)) continue;

      const content = await this.vault.cachedRead(metaFile);
      const comp = parseCompendiumMetadata(content, child.path);
      if (comp) {
        this.addCompendium(comp);
      }
    }
  }

  /**
   * Iterate all compendiums, scan .md files (excluding `_compendium.md`),
   * parse with parseEntityFile, and register in the EntityRegistry.
   * Returns the total count of entities loaded.
   */
  async loadAllEntities(): Promise<number> {
    let totalCount = 0;

    for (const comp of this.compendiums.values()) {
      const folder = this.vault.getAbstractFileByPath(comp.folderPath);
      if (!(folder instanceof TFolder)) continue;

      const mdFiles = collectMarkdownFiles(folder);

      for (const file of mdFiles) {
        if (file.name === "_compendium.md") continue;

        const content = await this.vault.cachedRead(file);
        const entity = parseEntityFile(content);
        if (!entity) continue;

        const registered: RegisteredEntity = {
          slug: entity.slug,
          name: entity.name,
          entityType: entity.entityType,
          filePath: file.path,
          data: entity.data,
          compendium: comp.name,
          readonly: comp.readonly,
          homebrew: comp.homebrew,
        };
        this.registry.register(registered);
        totalCount++;
      }
    }

    return totalCount;
  }

  /**
   * Create a new compendium: creates the folder and `_compendium.md` file.
   */
  async create(
    name: string,
    description: string,
    homebrew: boolean,
    readonly: boolean,
  ): Promise<Compendium> {
    const folderPath = `${this.compendiumRoot}/${name}`;
    const comp: Compendium = {
      name,
      description,
      readonly,
      homebrew,
      folderPath,
    };

    // Create folder (may already exist)
    try {
      await this.vault.createFolder(folderPath);
    } catch {
      // Folder already exists — that's fine
    }

    const metaContent = generateCompendiumMetadata(comp);
    await this.vault.create(`${folderPath}/_compendium.md`, metaContent);

    this.addCompendium(comp);
    return comp;
  }

  /**
   * Update the readonly flag for a compendium via a lossless key-level merge
   * into its `_compendium.md` (unknown frontmatter keys and body preserved).
   */
  async setReadonly(name: string, value: boolean): Promise<void> {
    const comp = this.compendiums.get(name);
    if (!comp) {
      throw new Error(`Compendium not found: ${name}`);
    }

    comp.readonly = value;
    await this.writeMetadataKeys(comp, { readonly: value });
  }

  /**
   * Merge the given frontmatter keys into a compendium's `_compendium.md`,
   * preserving all other keys and the body. Falls back to full regeneration
   * from the in-memory model only when the existing file has no parseable
   * frontmatter (corrupt/empty — it carried nothing worth preserving).
   */
  private async writeMetadataKeys(
    comp: Compendium,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const metaPath = `${comp.folderPath}/_compendium.md`;
    const metaFile = this.vault.getAbstractFileByPath(metaPath);
    if (!(metaFile instanceof TFile)) {
      throw new Error(`Compendium metadata file not found: ${metaPath}`);
    }

    const current = await this.vault.cachedRead(metaFile);
    const next =
      updateCompendiumFrontmatter(current, updates) ??
      generateCompendiumMetadata(comp);
    await this.vault.modify(metaFile, next);
  }

  /**
   * Create a new entity file in a compendium and register it in the registry.
   */
  async saveEntity(
    compendiumName: string,
    entityType: string,
    data: Record<string, unknown>,
  ): Promise<RegisteredEntity> {
    const comp = this.compendiums.get(compendiumName);
    if (!comp) {
      throw new Error(`Compendium not found: ${compendiumName}`);
    }

    const name = data.name as string;
    if (!name) {
      throw new Error("Entity data must include a 'name' field");
    }

    // Type-namespaced, compendium-prefixed slug:
    // `<compendium-id>_<entity-type>_<name-slug>`. The compendium prefix makes
    // slugs globally unique across compendiums; the entity-type token matches
    // the SRD generator and disambiguates same-name entities of different kinds.
    // ensureUniqueSlug still handles in-compendium duplicates ("Dwarf" + "Dwarf"
    // → "..._race_dwarf" and "..._race_dwarf-custom").
    const baseSlug = buildHomebrewSlug({
      compendium: comp.name,
      entityType,
      name,
    });
    const slug = ensureUniqueSlug(baseSlug, this.registry.getAllSlugs());

    const typeFolder = TYPE_FOLDER_MAP[entityType] || entityType;
    const folderPath = `${comp.folderPath}/${typeFolder}`;
    const filePath = `${folderPath}/${name}.md`;

    // Ensure type subfolder exists
    try {
      await this.vault.createFolder(folderPath);
    } catch {
      // Folder already exists
    }

    const entityNote: EntityNote = {
      slug,
      name,
      entityType,
      compendium: compendiumName,
      data,
    };

    const markdown = generateEntityMarkdown(entityNote);
    await this.vault.create(filePath, markdown);

    const registered: RegisteredEntity = {
      slug,
      name,
      entityType,
      filePath,
      data,
      compendium: compendiumName,
      readonly: comp.readonly,
      homebrew: comp.homebrew,
    };

    this.registry.register(registered);
    return registered;
  }

  /**
   * Update an existing entity file and re-register it in the registry.
   */
  async updateEntity(
    slug: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const existing = this.registry.getBySlug(slug);
    if (!existing) {
      throw new Error(`Entity not found: ${slug}`);
    }

    const file = this.vault.getAbstractFileByPath(existing.filePath);
    if (!(file instanceof TFile)) {
      throw new Error(`Entity file not found: ${existing.filePath}`);
    }

    const entityNote: EntityNote = {
      slug: existing.slug,
      name: existing.name,
      entityType: existing.entityType,
      compendium: existing.compendium,
      data,
    };

    const markdown = generateEntityMarkdown(entityNote);
    await this.vault.modify(file, markdown);

    // Re-register with updated data
    const updated: RegisteredEntity = {
      ...existing,
      data,
    };
    this.registry.register(updated);
  }

  /**
   * Delete an entity file from its compendium and unregister it.
   */
  async deleteEntity(slug: string): Promise<void> {
    const existing = this.registry.getBySlug(slug);
    if (!existing) {
      throw new Error(`Entity not found: ${slug}`);
    }

    const file = this.vault.getAbstractFileByPath(existing.filePath);
    if (file) {
      await this.fileManager.trashFile(file);
    }

    this.registry.unregisterByTypeAndSlug(existing.entityType, slug);
  }

  /**
   * Count files referencing a slug via {{type:slug}} or {{slug}} patterns.
   * Excludes the entity's own compendium file and an optional exclude path.
   */
  async countReferences(slug: string, excludePath?: string): Promise<number> {
    const entity = this.registry.getBySlug(slug);
    const entityFilePath = entity?.filePath;

    const refPatterns = [
      `{{${slug}}}`,
      `{{monster:${slug}}}`,
      `{{spell:${slug}}}`,
      `{{item:${slug}}}`,
    ];

    let count = 0;
    const files = this.vault.getMarkdownFiles();

    for (const file of files) {
      if (file.path === entityFilePath) continue;
      if (excludePath && file.path === excludePath) continue;

      const content = await this.vault.cachedRead(file);
      if (refPatterns.some((p) => content.includes(p))) {
        count++;
      }
    }

    return count;
  }
}
