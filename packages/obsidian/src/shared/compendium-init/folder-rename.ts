import type { Vault } from "obsidian";

/**
 * Rename a folder if it exists; otherwise no-op. Returns "renamed" if the
 * rename happened and "noop" if `oldPath` did not exist (idempotency: a
 * second migration call sees the new name and does nothing).
 */
export async function renameFolder(
  vault: Vault,
  oldPath: string,
  newPath: string,
): Promise<"renamed" | "noop"> {
  if (!(await vault.adapter.exists(oldPath))) return "noop";
  await vault.adapter.rename(oldPath, newPath);
  return "renamed";
}
