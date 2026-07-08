import type { Vault } from "obsidian";

/**
 * Copy each file in `files` from `sourceRoot` into `backupRoot`, preserving
 * the relative subfolder structure. Parent directories are created as needed.
 * Files outside `sourceRoot` are skipped.
 *
 * Idempotent: re-running with the same inputs overwrites the backup files.
 */
export async function backupFiles(
  vault: Vault,
  sourceRoot: string,
  files: string[],
  backupRoot: string,
): Promise<void> {
  const folders = new Set<string>();
  const sourcePrefix = `${sourceRoot}/`;
  for (const file of files) {
    if (!file.startsWith(sourcePrefix)) continue;
    const rel = file.slice(sourcePrefix.length);
    const dest = `${backupRoot}/${rel}`;
    const parts = dest.split("/");
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
  for (const file of files) {
    if (!file.startsWith(sourcePrefix)) continue;
    const rel = file.slice(sourcePrefix.length);
    const dest = `${backupRoot}/${rel}`;
    const content = await vault.adapter.read(file);
    await vault.adapter.write(dest, content);
  }
}
