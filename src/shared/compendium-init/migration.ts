import type { Vault } from "obsidian";
import { detectModifiedFiles } from "./modification-detector";
import { backupFiles } from "./backup";
import { renameFolder } from "./folder-rename";
import { rewriteFrontmatter, type FrontmatterTransform } from "./frontmatter-rewrite";
import { qualifyWikilinks } from "./wikilink-qualifier";

export interface MigrationOptions {
  vault: Vault;
  /** Existing folder name (e.g. "Compendium/SRD"). */
  oldFolder: string;
  /** Target folder name (e.g. "Compendium/SRD 5e"). */
  newFolder: string;
  /** Backup destination for user-modified notes (e.g. "Compendium/SRD.backup.20260429"). */
  backupRoot: string;
  /** Frontmatter keys considered plugin-managed (used by modification detector). */
  knownFrontmatterKeys: string[];
  /** Transform applied to every file's frontmatter inside `newFolder`. */
  frontmatterTransform: FrontmatterTransform;
  /** Map of unqualified slug → qualified vault path for wikilink rewrite. */
  slugMap: Map<string, string>;
  /** Vault root for the wikilink qualification sweep (use "" for whole vault). */
  vaultRoot: string;
}

export interface MigrationResult {
  modifiedFilesBackedUp: number;
  folderRenamed: "renamed" | "noop";
  frontmatterRewrites: number;
  wikilinksRewritten: number;
  filesScanned: number;
}

/**
 * One-shot migration: detect user-modified readonly notes, back them up,
 * rename the compendium folder, rewrite frontmatter to match the new layout,
 * and qualify unqualified wikilinks across user notes. Idempotent — a
 * second invocation finds the old folder gone and reports zero work.
 */
export async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  const modified = await detectModifiedFiles({
    vault: options.vault,
    folder: options.oldFolder,
    knownFrontmatterKeys: options.knownFrontmatterKeys,
  });

  if (modified.length > 0) {
    await backupFiles(options.vault, options.oldFolder, modified, options.backupRoot);
  }

  const folderRenamed = await renameFolder(options.vault, options.oldFolder, options.newFolder);

  const frontmatterRewrites = await rewriteFrontmatter(
    options.vault,
    options.newFolder,
    options.frontmatterTransform,
  );

  const wikilinkResult = await qualifyWikilinks(
    options.vault,
    options.vaultRoot,
    options.slugMap,
  );

  return {
    modifiedFilesBackedUp: modified.length,
    folderRenamed,
    frontmatterRewrites,
    wikilinksRewritten: wikilinkResult.linksRewritten,
    filesScanned: wikilinkResult.filesScanned,
  };
}
