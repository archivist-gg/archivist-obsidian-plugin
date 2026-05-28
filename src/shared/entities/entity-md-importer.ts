import type { Vault } from "obsidian";
import { SRD_MD_ENTRIES } from "../../data/srd/index.generated";
import { TYPE_FOLDER_MAP } from "./entity-vault-store";

const INVALID_FILENAME_CHARS = /[/:*?"<>|\\]/g;

function sanitizeFilename(name: string): string {
  return name.replace(INVALID_FILENAME_CHARS, "_");
}

export async function importSrdBundledMdToVault(
  vault: Vault,
  compendiumRoot: string,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  let created = 0;
  for (let i = 0; i < SRD_MD_ENTRIES.length; i++) {
    const entry = SRD_MD_ENTRIES[i];
    const entityType = entry.type.replace(/s$/, "");
    const folder = TYPE_FOLDER_MAP[entityType] ?? entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
    const folderPath = `${compendiumRoot}/SRD/${folder}`;
    const filePath = `${folderPath}/${sanitizeFilename(entry.name)}.md`;

    if (await vault.adapter.exists(filePath)) {
      onProgress?.(i + 1, SRD_MD_ENTRIES.length);
      continue;
    }

    if (!(await vault.adapter.exists(folderPath))) {
      await vault.adapter.mkdir(folderPath);
    }
    await vault.adapter.write(filePath, entry.content);
    created++;
    onProgress?.(i + 1, SRD_MD_ENTRIES.length);
  }
  return created;
}
