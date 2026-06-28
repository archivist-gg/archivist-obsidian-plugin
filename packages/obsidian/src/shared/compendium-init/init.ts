import type { Vault } from "obsidian";
import { copyBundle, type CompendiumBundle } from "./bundle-copier";
import { getInstalledCompendiumVersion, compareWithBundle } from "./compendium-version";

export interface InitCompendiumOptions {
  /** User vault root for compendiums (e.g. "Compendium"). */
  rootFolder: string;
  /** Compendium folder name (e.g. "SRD 5e"). */
  compendiumName: string;
  /** Path-to-content map for files under `<compendiumName>/...`. */
  bundle: CompendiumBundle;
  /** Bundled compendium version (compared with installed). */
  bundleVersion: string;
}

/**
 * Initialize a single compendium in the user's vault. Reads the installed
 * version (if any), compares with the bundled version, and either skips
 * (already up-to-date) or copies the bundle into place (fresh install or
 * upgrade). Migration logic from a future phase will plug in here.
 */
export async function initializeCompendium(
  vault: Vault,
  options: InitCompendiumOptions,
): Promise<"skipped" | "copied"> {
  const compendiumPath = `${options.rootFolder}/${options.compendiumName}`;
  const installed = await getInstalledCompendiumVersion(vault, compendiumPath);
  const action = compareWithBundle(installed, options.bundleVersion);
  if (action === "up-to-date") return "skipped";
  // For fresh OR upgrade-available, copy.
  // (Migration step from a later phase will plug in here.)
  await copyBundle(vault, options.rootFolder, options.bundle);
  return "copied";
}
