import * as yaml from "js-yaml";
import type { Vault } from "obsidian";
import type { CompendiumBundle } from "./bundle-copier";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/**
 * The `archivist_compendium_version` stamp of a `_compendium.md` body, or null when the
 * content has no frontmatter, the YAML does not parse, or the key is absent or not a
 * string (a hand-edited `1.0` parses as a float and is null here on purpose).
 */
export function parseCompendiumVersion(content: string): string | null {
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

export type InstalledVersion =
  | { state: "absent" }
  | { state: "unreadable" }
  | { state: "ok"; version: string };

/**
 * The installed stamp of `<compendiumPath>/_compendium.md`, read through the adapter so a
 * file the vault index has not picked up yet is still seen (an index-lagged read would
 * report a present file as `absent` and route it to the verbatim fresh-install path).
 * `absent` means the FILE does not exist; `unreadable` means it exists without a readable stamp.
 */
export async function readInstalledCompendiumVersion(
  vault: Vault,
  compendiumPath: string,
): Promise<InstalledVersion> {
  const indexPath = `${compendiumPath}/_compendium.md`;
  if (!(await vault.adapter.exists(indexPath))) return { state: "absent" };
  const version = parseCompendiumVersion(await vault.adapter.read(indexPath));
  return version === null ? { state: "unreadable" } : { state: "ok", version };
}

/**
 * The stamp baked into the sub-bundle's OWN `<compendiumName>/_compendium.md`. This is the
 * only version authority the bootstrap has: there is deliberately no other input through
 * which a version from a different namespace (the plugin manifest, for one) can arrive.
 */
export function readBundleVersion(bundle: CompendiumBundle, compendiumName: string): string | null {
  const content = bundle[`${compendiumName}/_compendium.md`];
  return typeof content === "string" ? parseCompendiumVersion(content) : null;
}

export type CompendiumPlanAction = "fresh" | "up-to-date" | "upgrade-available" | "error";

/**
 * `error`: the bundle's stamp is unreadable, nothing may be copied (copying would recreate a
 * loop that never heals). `fresh`: no index file. `upgrade-available`: the index exists and
 * its stamp is unreadable or differs (plain inequality: the vault mirrors the shipped
 * bundle, so a plugin downgrade re-copies the older bundle and still converges).
 */
export function planAction(installed: InstalledVersion, bundleVersion: string | null): CompendiumPlanAction {
  if (bundleVersion === null) return "error";
  if (installed.state === "absent") return "fresh";
  if (installed.state === "unreadable") return "upgrade-available";
  return installed.version === bundleVersion ? "up-to-date" : "upgrade-available";
}
