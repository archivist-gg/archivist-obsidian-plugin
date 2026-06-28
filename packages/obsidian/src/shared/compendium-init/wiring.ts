import { type Vault, TFolder } from "obsidian";
import { initializeCompendium } from "./init";
import { embeddedBundle, splitBundleByCompendium } from "./embedded-bundle";

export interface CompendiumWiringOptions {
  vault: Vault;
  /** Vault-relative folder that contains all compendiums (e.g. "Compendium"). */
  rootFolder: string;
  /** Plugin manifest version — written to `_compendium.md` and used to
   *  detect upgrade-vs-up-to-date on subsequent loads. */
  pluginVersion: string;
  /** When true, removes `<rootFolder>/SRD` before copying the new editions.
   *  Skip-migration shortcut: any user edits there are gone. */
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
      await opts.vault.delete(legacy, true);
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
