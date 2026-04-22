import type { Vault } from "obsidian";
import { generateEntityMarkdown, TYPE_FOLDER_MAP } from "./entity-vault-store";
import { generateCompendiumMetadata } from "./compendium-manager";
import { normalizeSrdMonster, normalizeSrdItem, normalizeSrdSpell } from "./srd-normalizer";

// ---------------------------------------------------------------------------
// SrdStoreLike — structural interface matching the subset of SrdStore we need.
// Avoids a cross-tree dep on ../ai/srd/srd-store so this file stays
// self-contained within src/shared/. The concrete SrdStore in src/ai/srd/
// satisfies this shape by construction.
// ---------------------------------------------------------------------------

interface SrdEntityLike {
  slug: string;
  name: string;
  entityType: string;
  data: Record<string, unknown>;
}

export interface SrdStoreLike {
  getTypes(): string[];
  getAllOfType(entityType: string): SrdEntityLike[];
}

// ---------------------------------------------------------------------------
// Filename sanitization
// ---------------------------------------------------------------------------

/** Characters illegal in file names on common OSes. */
const INVALID_FILENAME_CHARS = /[/:*?"<>|\\]/g;

/**
 * Replace OS-invalid filename characters with underscores.
 */
function sanitizeFilename(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, "_");
}

// ---------------------------------------------------------------------------
// importSrdToVault
// ---------------------------------------------------------------------------

/**
 * Generates vault notes for every SRD entity under `{compendiumRoot}/SRD/`.
 *
 * - Creates type subfolders (e.g. `Compendium/SRD/Monsters/`)
 * - Skips files that already exist (resume-safe)
 * - Reports progress via optional callback every 50 entities
 * - Returns the total number of notes created
 */
export async function importSrdToVault(
  vault: Vault,
  srdStore: SrdStoreLike,
  compendiumRoot: string,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  // 1. Collect all entities
  const types = srdStore.getTypes();
  const allEntities: {
    slug: string;
    name: string;
    entityType: string;
    data: Record<string, unknown>;
  }[] = [];

  for (const entityType of types) {
    const entities = srdStore.getAllOfType(entityType);
    allEntities.push(...entities);
  }

  const total = allEntities.length;
  if (total === 0) return 0;

  // 2. Ensure base folder exists
  const srdRoot = `${compendiumRoot}/SRD`;
  await ensureFolderExists(vault, compendiumRoot);
  await ensureFolderExists(vault, srdRoot);

  // 2b. Create _compendium.md if it doesn't exist
  const compMetaPath = `${srdRoot}/_compendium.md`;
  if (!vault.getAbstractFileByPath(compMetaPath)) {
    const metaMd = generateCompendiumMetadata({
      name: "SRD",
      description: "D&D 5e System Reference Document",
      readonly: true,
      homebrew: false,
      folderPath: srdRoot,
    });
    await vault.create(compMetaPath, metaMd);
  }

  // 3. Pre-create all type subfolders
  const neededFolders = new Set<string>();
  for (const entityType of types) {
    const folderName = TYPE_FOLDER_MAP[entityType] ?? capitalize(entityType);
    neededFolders.add(`${srdRoot}/${folderName}`);
  }
  for (const folder of neededFolders) {
    await ensureFolderExists(vault, folder);
  }

  // 4. Import each entity
  let created = 0;
  for (let i = 0; i < allEntities.length; i++) {
    const entity = allEntities[i];
    const folderName =
      TYPE_FOLDER_MAP[entity.entityType] ?? capitalize(entity.entityType);
    const fileName = sanitizeFilename(entity.name);
    const filePath = `${srdRoot}/${folderName}/${fileName}.md`;

    // Skip if file already exists (resume support)
    const existing = vault.getAbstractFileByPath(filePath);
    if (existing) {
      // Report progress even for skipped files
      if (onProgress && (i + 1) % 50 === 0) {
        onProgress(i + 1, total);
      }
      continue;
    }

    // Normalize SRD data to match our parser's expected field names/shapes
    let entityData = entity.data;
    if (entity.entityType === "monster") {
      entityData = normalizeSrdMonster(entityData);
    } else if (entity.entityType === "spell") {
      entityData = normalizeSrdSpell(entityData);
    } else if (entity.entityType === "item") {
      entityData = normalizeSrdItem(entityData);
    }

    const markdown = generateEntityMarkdown({
      slug: entity.slug,
      name: entity.name,
      entityType: entity.entityType,
      compendium: "SRD",
      data: entityData,
    });

    await vault.create(filePath, markdown);
    created++;

    // Report progress every 50 entities
    if (onProgress && (i + 1) % 50 === 0) {
      onProgress(i + 1, total);
    }
  }

  // Final progress report
  if (onProgress && total % 50 !== 0) {
    onProgress(total, total);
  }

  return created;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Creates a folder if it does not already exist.
 */
async function ensureFolderExists(vault: Vault, path: string): Promise<void> {
  const existing = vault.getAbstractFileByPath(path);
  if (!existing) {
    try {
      await vault.createFolder(path);
    } catch {
      // Folder may already exist on disk but not yet indexed by the vault
    }
  }
}

/**
 * Capitalize a string for use as a fallback folder name.
 */
function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
