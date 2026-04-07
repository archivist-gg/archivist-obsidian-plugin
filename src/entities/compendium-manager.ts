import * as yaml from "js-yaml";
import {
  EntityNote,
  generateEntityMarkdown,
  parseEntityFile,
  TYPE_FOLDER_MAP,
  slugify,
  ensureUniqueSlug,
} from "./entity-vault-store";
import { EntityRegistry, RegisteredEntity } from "./entity-registry";

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
// collectMarkdownFiles (helper)
// ---------------------------------------------------------------------------

/**
 * Recursively collects all .md files from a folder and its subfolders.
 * Vault folders have a `children` array; files have a `name` property.
 */
function collectMarkdownFiles(folder: any): any[] {
  const files: any[] = [];
  if (!folder || !folder.children) return files;

  for (const child of folder.children) {
    if (child.children) {
      // It's a subfolder — recurse
      files.push(...collectMarkdownFiles(child));
    } else if (child.name && child.name.endsWith(".md")) {
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
  private vault: any;
  private compendiumRoot: string;

  constructor(registry: EntityRegistry, vault: any, compendiumRoot: string) {
    this.registry = registry;
    this.vault = vault;
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
    if (!rootFolder || !rootFolder.children) return;

    for (const child of rootFolder.children) {
      // Only look at subfolders
      if (!child.children) continue;

      const metaPath = `${child.path}/_compendium.md`;
      const metaFile = this.vault.getAbstractFileByPath(metaPath);
      if (!metaFile) continue;

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
      if (!folder || !folder.children) continue;

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
   * Update the readonly flag for a compendium by rewriting its `_compendium.md`.
   */
  async setReadonly(name: string, value: boolean): Promise<void> {
    const comp = this.compendiums.get(name);
    if (!comp) {
      throw new Error(`Compendium not found: ${name}`);
    }

    comp.readonly = value;

    const metaPath = `${comp.folderPath}/_compendium.md`;
    const metaFile = this.vault.getAbstractFileByPath(metaPath);
    if (!metaFile) {
      throw new Error(`Compendium metadata file not found: ${metaPath}`);
    }

    const metaContent = generateCompendiumMetadata(comp);
    await this.vault.modify(metaFile, metaContent);
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

    const baseSlug = slugify(name);
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
    if (!file) {
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
      await this.vault.delete(file);
    }

    this.registry.unregister(slug);
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
