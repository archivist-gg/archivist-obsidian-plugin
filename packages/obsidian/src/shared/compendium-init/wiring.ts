import { type Vault, type FileManager, TFolder } from "obsidian";
import { initializeCompendium } from "./init";
import { embeddedBundle, splitBundleByCompendium } from "./embedded-bundle";

export interface CompendiumWiringOptions {
  vault: Vault;
  /** Used to trash the legacy SRD folder via the user's deletion preference. */
  fileManager: FileManager;
  /** Vault-relative folder that contains all compendiums (e.g. "Compendium"). */
  rootFolder: string;
  /** Plugin manifest version — written to `_compendium.md` and used to
   *  detect upgrade-vs-up-to-date on subsequent loads. */
  pluginVersion: string;
  /** When true, removes `<rootFolder>/SRD` before copying the new editions.
   *  Skip-migration shortcut: any user edits there are moved to trash (per the
   *  user's "Deleted files" setting), not permanently destroyed. */
  removeLegacySrdFolder: boolean;
}

export interface CompendiumWiringResult {
  legacySrdRemoved: boolean;
  perCompendium: Array<{ compendium: string; action: "skipped" | "copied" }>;
}

/**
 * Auto-run on plugin load. For each compendium in the embedded bundle, check
 * the installed version and copy the bundle if missing or outdated. Optionally
 * delete the legacy `Compendium/SRD/` folder first (this replaces the
 * Phase 13 migration orchestrator for users who don't need a backup-prompt UX).
 */
export async function bootstrapCompendiums(opts: CompendiumWiringOptions): Promise<CompendiumWiringResult> {
  let legacySrdRemoved = false;
  if (opts.removeLegacySrdFolder) {
    const legacyPath = `${opts.rootFolder}/SRD`;
    const legacy = opts.vault.getAbstractFileByPath(legacyPath);
    if (legacy instanceof TFolder) {
      // Trash (don't permanently delete) so the user can recover the legacy
      // folder per their Obsidian "Deleted files" preference.
      await opts.fileManager.trashFile(legacy);
      legacySrdRemoved = true;
    }
  }

  const perCompendium: CompendiumWiringResult["perCompendium"] = [];
  const subBundles = splitBundleByCompendium(embeddedBundle);
  for (const [compendium, bundle] of subBundles) {
    const action = await initializeCompendium(opts.vault, {
      rootFolder: opts.rootFolder,
      compendiumName: compendium,
      bundle,
      bundleVersion: opts.pluginVersion,
    });
    perCompendium.push({ compendium, action });
  }

  return { legacySrdRemoved, perCompendium };
}
