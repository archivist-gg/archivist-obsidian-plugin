import type { Vault } from "obsidian";

/**
 * Bundle is a map of relative path → file content.
 * The bundle is loaded at plugin build time and embedded as a JSON import
 * from `.compendium-bundle/index.json` (created by the canonical builder).
 */
export type CompendiumBundle = Record<string, string>;

/**
 * Copy a compendium bundle's ENTITY files into the user's vault under the given root folder
 * with overwrite semantics (readonly compendium notes are plugin-managed). Creates parent
 * directories as needed. The compendium's `_compendium.md` is NOT written here: the caller
 * strips it from the map and writes it last through `writeCompendiumIndex`
 * (compendium-index.ts), verbatim on a fresh install and as a lossless merge on an upgrade.
 */
export async function copyBundle(
  vault: Vault,
  rootFolder: string,
  bundle: CompendiumBundle,
): Promise<void> {
  const folders = new Set<string>();
  for (const relPath of Object.keys(bundle)) {
    const parts = `${rootFolder}/${relPath}`.split("/");
    parts.pop();
    for (let i = 1; i <= parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }

  const sortedFolders = Array.from(folders).sort((a, b) => a.length - b.length);
  for (const folder of sortedFolders) {
    if (!(await vault.adapter.exists(folder))) {
      await vault.adapter.mkdir(folder);
    }
  }

  for (const [relPath, content] of Object.entries(bundle)) {
    const fullPath = `${rootFolder}/${relPath}`;
    await vault.adapter.write(fullPath, content);
  }
}
