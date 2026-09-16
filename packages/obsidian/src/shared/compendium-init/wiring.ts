import { type Vault, type FileManager, TFolder } from "obsidian";
import { planCompendium, applyCompendium, type CompendiumPlanEntry, type CompendiumApplyResult } from "./init";
import { embeddedBundle, splitBundleByCompendium } from "./embedded-bundle";
import type { CompendiumBundle } from "./bundle-copier";

export interface CompendiumPlanOptions {
  vault: Vault;
  /** Vault-relative folder that contains all compendiums (e.g. "Compendium"), already normalized. */
  rootFolder: string;
  /** When true, `<rootFolder>/SRD` (the pre-canonical layout) is trashed per the user's
   *  "Deleted files" preference before the bundles are applied. */
  removeLegacySrdFolder: boolean;
}

export interface CompendiumApplyOptions extends CompendiumPlanOptions {
  fileManager: FileManager;
}

export interface CompendiumBootstrapPlan {
  entries: CompendiumPlanEntry[];
  legacySrdPresent: boolean;
  /** True when the apply would do anything a user should hear about: any entry not
   *  up-to-date (fresh, upgrade, error) or a legacy folder to trash. */
  shouldNotify: boolean;
}

export interface CompendiumBootstrapResult {
  legacySrdRemoved: boolean;
  perCompendium: CompendiumApplyResult[];
}

function legacySrdFolder(vault: Vault, rootFolder: string): TFolder | null {
  const legacy = vault.getAbstractFileByPath(`${rootFolder}/SRD`);
  return legacy instanceof TFolder ? legacy : null;
}

const failedReason = (compendium: string, err: unknown): string =>
  `${compendium} failed: ${err instanceof Error ? err.message : String(err)}; existing notes kept`;

/**
 * Read-only plan for every compendium in the embedded bundle. Each sub-bundle's own
 * `_compendium.md` stamp is compared with the installed one; nothing else is an input. An IO
 * rejection while reading one compendium's index becomes that compendium's `error` entry
 * (nothing is copied for it later) so a sibling still installs.
 */
export async function planCompendiumBootstrap(
  opts: CompendiumPlanOptions,
  bundle: CompendiumBundle = embeddedBundle,
): Promise<CompendiumBootstrapPlan> {
  const legacySrdPresent = opts.removeLegacySrdFolder && legacySrdFolder(opts.vault, opts.rootFolder) !== null;
  const entries: CompendiumPlanEntry[] = [];
  for (const [compendium, sub] of splitBundleByCompendium(bundle)) {
    try {
      entries.push(await planCompendium(opts.vault, { rootFolder: opts.rootFolder, compendiumName: compendium, bundle: sub }));
    } catch (err) {
      entries.push({
        compendium, action: "error", installed: { state: "unreadable" }, bundleVersion: null,
        reason: failedReason(compendium, err),
      });
    }
  }
  const shouldNotify = legacySrdPresent || entries.some((e) => e.action !== "up-to-date");
  return { entries, legacySrdPresent, shouldNotify };
}

const errorResult = (compendium: string, reason: string): CompendiumApplyResult =>
  ({ compendium, action: "error", reason, pruned: [], keptModified: [], pruneFailures: [] });

/**
 * Apply a plan. The legacy folder is trashed first (as before); then each compendium is
 * applied in its own try/catch so one failure never blocks its sibling.
 */
export async function applyCompendiumBootstrap(
  opts: CompendiumApplyOptions,
  plan: CompendiumBootstrapPlan,
  bundle: CompendiumBundle = embeddedBundle,
): Promise<CompendiumBootstrapResult> {
  let legacySrdRemoved = false;
  if (opts.removeLegacySrdFolder) {
    const legacy = legacySrdFolder(opts.vault, opts.rootFolder);
    if (legacy) {
      await opts.fileManager.trashFile(legacy);
      legacySrdRemoved = true;
    }
  }
  const subBundles = splitBundleByCompendium(bundle);
  const perCompendium: CompendiumApplyResult[] = [];
  for (const entry of plan.entries) {
    const sub = subBundles.get(entry.compendium);
    if (!sub) {
      perCompendium.push(errorResult(entry.compendium, `${entry.compendium} failed: sub-bundle missing at apply time; existing notes kept`));
      continue;
    }
    try {
      perCompendium.push(await applyCompendium(opts.vault, opts.fileManager,
        { rootFolder: opts.rootFolder, compendiumName: entry.compendium, bundle: sub }, entry));
    } catch (err) {
      perCompendium.push(errorResult(entry.compendium, failedReason(entry.compendium, err)));
    }
  }
  return { legacySrdRemoved, perCompendium };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The Notice text after an apply. Sentence case; the only proper noun is the compendium name. */
export function describeBootstrapResult(result: CompendiumBootstrapResult): string {
  const parts: string[] = [];
  const installed = result.perCompendium.filter((r) => r.action === "installed").map((r) => r.compendium);
  if (installed.length > 0) parts.push(`installed ${installed.join(" + ")}`);
  for (const r of result.perCompendium) {
    if (r.action === "upgraded") {
      const details: string[] = [];
      if (r.pruned.length > 0) details.push(`pruned ${plural(r.pruned.length, "stale note", "stale notes")}`);
      if (r.keptModified.length > 0) details.push(`kept ${r.keptModified.length} modified`);
      if (r.pruneFailures.length > 0) details.push(`${r.pruneFailures.length} could not be trashed`);
      parts.push(`updated ${r.compendium}${details.length > 0 ? ` (${details.join(", ")})` : ""}`);
    } else if (r.action === "error") {
      parts.push(r.reason ?? `${r.compendium} failed; existing notes kept`);
    }
  }
  const summary = parts.length > 0 ? parts.join("; ") : "compendiums up-to-date";
  const legacy = result.legacySrdRemoved ? " (legacy SRD removed)" : "";
  return `Archivist: ${summary}${legacy}`;
}
