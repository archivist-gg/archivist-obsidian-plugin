import * as yaml from "js-yaml";
import type { Vault } from "obsidian";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/**
 * Read the installed compendium version from `<compendiumPath>/_compendium.md`.
 * Returns `null` if the file is missing, frontmatter is malformed, or the
 * `archivist_compendium_version` key is absent / not a string.
 */
export async function getInstalledCompendiumVersion(
  vault: Vault,
  compendiumPath: string,
): Promise<string | null> {
  const indexPath = `${compendiumPath}/_compendium.md`;
  if (!(await vault.adapter.exists(indexPath))) return null;
  const content = await vault.adapter.read(indexPath);
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  try {
    const fm = yaml.load(match[1]) as Record<string, unknown> | null;
    const version = fm?.archivist_compendium_version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

export type VersionCompareResult = "fresh" | "up-to-date" | "upgrade-available";

/**
 * Compare the installed compendium version against the bundled version.
 *  - `null` installed -> `fresh` (no install yet).
 *  - exact match -> `up-to-date`.
 *  - any difference -> `upgrade-available`.
 */
export function compareWithBundle(installed: string | null, bundle: string): VersionCompareResult {
  if (installed === null) return "fresh";
  if (installed === bundle) return "up-to-date";
  return "upgrade-available";
}
