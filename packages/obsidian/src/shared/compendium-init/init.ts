import type { Vault } from "obsidian";
import { copyBundle, type CompendiumBundle } from "./bundle-copier";
import { readInstalledCompendiumVersion, readBundleVersion, planAction } from "./compendium-version";

export interface InitCompendiumOptions {
  /** User vault root for compendiums (e.g. "Compendium"). */
  rootFolder: string;
  /** Compendium folder name (e.g. "SRD 5e"). */
  compendiumName: string;
  /** Path-to-content map for files under `<compendiumName>/...`. */
  bundle: CompendiumBundle;
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
  const installed = await readInstalledCompendiumVersion(vault, compendiumPath);
  const action = planAction(installed, readBundleVersion(options.bundle, options.compendiumName));
  if (action === "up-to-date" || action === "error") return "skipped";
  // For fresh OR upgrade-available, copy.
  // (Migration step from a later phase will plug in here.)
  await copyBundle(vault, options.rootFolder, options.bundle);
  return "copied";
}
