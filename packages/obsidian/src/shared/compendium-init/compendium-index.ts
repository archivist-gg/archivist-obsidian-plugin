import * as yaml from "js-yaml";
import { TFile, type Vault } from "obsidian";
import { updateCompendiumFrontmatter } from "../entities/compendium-manager";

/**
 * Frontmatter keys of `_compendium.md` the USER owns through the settings tab
 * (`CompendiumManager.setReadonly` / `setHidden`). An upgrade never overwrites a declared
 * value. They differ when ABSENT: `readonly` is restored from the bundle (a missing key parses
 * as `false` and would make a readonly compendium writable), while `hidden` is never written
 * on the merge path, because its absence is a third state (`hiddenDeclared: false`) that
 * `reconcileHiddenCompendiums` owns. (A fresh install writes the baked index verbatim, so a
 * future baked `hidden` would land there; the bundle-tripwires test pins the baked key set.)
 * Today's baked index carries no `hidden` key, so against the shipped bundle the writer's own
 * rule (every key it is not given survives) is what keeps a declared `hidden`. Every other
 * baked key is bundle-owned and is refreshed on upgrade, including `name` (bundle identity:
 * every note carries `compendium: <name>`).
 */
export const USER_OWNED_INDEX_KEYS = ["readonly", "hidden"] as const;
/** The user-owned keys an upgrade restores from the bundle when the vault does not DECLARE them (a boolean value). */
const RESTORED_WHEN_UNDECLARED: readonly string[] = ["readonly"];

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/** Parsed frontmatter of a `_compendium.md` body, or null when there is none or it does not parse. */
function frontmatterOf(content: string): Record<string, unknown> | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  let fm: unknown;
  try {
    fm = yaml.load(match[1]);
  } catch {
    return null;
  }
  return fm && typeof fm === "object" ? (fm as Record<string, unknown>) : null;
}

/**
 * The keys an upgrade writes into an existing index: every baked key, EXCEPT the user-owned
 * ones, which are written only when they are in RESTORED_WHEN_UNDECLARED and the existing
 * frontmatter does not DECLARE them (no boolean value): a hand-removed or hand-mangled
 * `readonly` is restored from the bundle; a declared toggle always wins; `hidden` is never
 * written here.
 */
export function indexUpdates(existing: string, baked: string): Record<string, unknown> {
  const bakedFm = frontmatterOf(baked) ?? {};
  const existingFm = frontmatterOf(existing) ?? {};
  const userOwned: readonly string[] = USER_OWNED_INDEX_KEYS;
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bakedFm)) {
    if (userOwned.includes(key)) {
      const declared = typeof existingFm[key] === "boolean";
      if (declared || !RESTORED_WHEN_UNDECLARED.includes(key)) continue;
    }
    updates[key] = value;
  }
  return updates;
}

/**
 * The content an upgrade writes to `_compendium.md`. No existing file: the baked bytes. An
 * existing file with parseable frontmatter: the lossless key-level merge (`indexUpdates`
 * applied, everything else preserved, body verbatim). An existing file with no parseable
 * frontmatter has nothing recoverable and is replaced by the baked bytes so the stamp lands.
 */
export function mergeCompendiumIndex(existing: string | null, baked: string): string {
  if (existing === null) return baked;
  return updateCompendiumFrontmatter(existing, indexUpdates(existing, baked)) ?? baked;
}

export type IndexWriteVia = "process" | "adapter";

/**
 * Writes the compendium index. `verbatim` (fresh install) goes through the adapter, like the
 * entity files. `merge` (upgrade) goes through `vault.process` on the indexed TFile so the
 * new stamp is visible to `cachedRead` later in the same load (the hidden-flag reconcile
 * reads and rewrites this very file after the bootstrap); when the file is on disk but not
 * yet indexed it falls back to an adapter read-merge-write and reports it.
 */
export async function writeCompendiumIndex(
  vault: Vault,
  indexPath: string,
  baked: string,
  mode: "verbatim" | "merge",
): Promise<IndexWriteVia> {
  if (mode === "verbatim") {
    await vault.adapter.write(indexPath, baked);
    return "adapter";
  }
  const file = vault.getAbstractFileByPath(indexPath);
  if (file instanceof TFile) {
    await vault.process(file, (data) => mergeCompendiumIndex(data, baked));
    return "process";
  }
  const existing = (await vault.adapter.exists(indexPath)) ? await vault.adapter.read(indexPath) : null;
  await vault.adapter.write(indexPath, mergeCompendiumIndex(existing, baked));
  return "adapter";
}
