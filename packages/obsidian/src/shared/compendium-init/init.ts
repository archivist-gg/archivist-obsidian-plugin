import type { Vault, FileManager } from "obsidian";
import { copyBundle, type CompendiumBundle } from "./bundle-copier";
import {
  readInstalledCompendiumVersion,
  readBundleVersion,
  planAction,
  type InstalledVersion,
  type CompendiumPlanAction,
} from "./compendium-version";
import { writeCompendiumIndex, type IndexWriteVia } from "./compendium-index";
import { pruneOrphans, type PruneReport } from "./prune";

export interface InitCompendiumOptions {
  /** User vault root for compendiums (e.g. "Compendium"), already normalized. */
  rootFolder: string;
  /** Compendium folder name (e.g. "SRD 5e"). */
  compendiumName: string;
  /** Path-to-content map for files under `<compendiumName>/...`, its own `_compendium.md` included. */
  bundle: CompendiumBundle;
}

export interface CompendiumPlanEntry {
  compendium: string;
  action: CompendiumPlanAction;
  installed: InstalledVersion;
  bundleVersion: string | null;
  /** Set on `error`. */
  reason?: string;
}

export interface CompendiumApplyResult extends PruneReport {
  compendium: string;
  action: "skipped" | "installed" | "upgraded" | "error";
  reason?: string;
  /** Upgrade path only: "adapter" means no TFile was indexed for the index file (reported, not hidden). */
  indexWrite?: IndexWriteVia;
}

/** Read-only: what the bootstrap would do for one compendium. */
export async function planCompendium(vault: Vault, options: InitCompendiumOptions): Promise<CompendiumPlanEntry> {
  const installed = await readInstalledCompendiumVersion(vault, `${options.rootFolder}/${options.compendiumName}`);
  const bundleVersion = readBundleVersion(options.bundle, options.compendiumName);
  const action = planAction(installed, bundleVersion);
  const entry: CompendiumPlanEntry = { compendium: options.compendiumName, action, installed, bundleVersion };
  if (action === "error") entry.reason = `could not read the bundled version for ${options.compendiumName}; nothing copied`;
  return entry;
}

const noPrune = (): PruneReport => ({ pruned: [], keptModified: [], pruneFailures: [] });

/**
 * Apply one plan entry. Order per compendium: entity files, then (upgrade only) the prune,
 * then the index LAST, so a failure mid-copy leaves the old stamp and the next load retries,
 * and a prune that runs before the stamp cannot be skipped forever by a crash in between.
 * The compendium folder is created by the entity files' copy (the index entry is stripped
 * before copyBundle), so the verbatim index write on a fresh install relies on the sub-bundle
 * having entity notes; every shipped one does (spec §8 records the residual).
 */
export async function applyCompendium(
  vault: Vault,
  fileManager: FileManager,
  options: InitCompendiumOptions,
  entry: CompendiumPlanEntry,
): Promise<CompendiumApplyResult> {
  const base = { compendium: options.compendiumName, ...noPrune() };
  if (entry.action === "up-to-date") return { ...base, action: "skipped" };
  if (entry.action === "error") return { ...base, action: "error", reason: entry.reason };

  const indexKey = `${options.compendiumName}/_compendium.md`;
  const indexPath = `${options.rootFolder}/${indexKey}`;
  const baked = options.bundle[indexKey];
  if (typeof baked !== "string") {
    return { ...base, action: "error", reason: `could not read the bundled version for ${options.compendiumName}; nothing copied` };
  }
  const entities: CompendiumBundle = {};
  for (const [key, content] of Object.entries(options.bundle)) if (key !== indexKey) entities[key] = content;

  await copyBundle(vault, options.rootFolder, entities);
  if (entry.action === "fresh") {
    await writeCompendiumIndex(vault, indexPath, baked, "verbatim");
    return { ...base, action: "installed" };
  }
  const prune = await pruneOrphans(vault, fileManager, options);
  const indexWrite = await writeCompendiumIndex(vault, indexPath, baked, "merge");
  return { ...base, ...prune, action: "upgraded", indexWrite };
}
