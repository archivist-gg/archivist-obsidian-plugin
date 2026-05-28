import type { Vault } from "obsidian";

/**
 * Bundle is a map of relative path → file content.
 * The bundle is loaded at plugin build time and embedded as a JSON import
 * from `.compendium-bundle/index.json` (created by the canonical builder).
 */
export type CompendiumBundle = Record<string, string>;

/**
 * Copy a compendium bundle into the user's vault under the given root folder.
 * Creates parent directories as needed. Uses overwrite semantics — safe because
 * readonly compendium notes are plugin-managed.
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
