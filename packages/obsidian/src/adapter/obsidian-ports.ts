import { Notice, type Vault } from "obsidian";
import type {
  StoragePort,
  ContentLookupPort,
  NotificationSink,
  EntryRef,
  EntityRegistry,
} from "@archivist/core";

/** Bridge: vault-backed StoragePort for the kernel. */
export function makeVaultStoragePort(vault: Vault): StoragePort {
  return {
    async listFolder(folder) {
      const f = vault.getFolderByPath(folder);
      if (!f) return [];
      return f.children.map((c): EntryRef => ({
        kind: "children" in c ? "folder" : "file",
        path: c.path,
        name: c.name,
      }));
    },
    async read(path) {
      const f = vault.getFileByPath(path);
      if (!f) throw new Error(`Not found: ${path}`);
      return vault.read(f);
    },
    async write(path, text) {
      const f = vault.getFileByPath(path);
      if (f) await vault.modify(f, text);
      else await vault.create(path, text);
    },
    async ensureFolder(path) {
      if (!vault.getFolderByPath(path)) await vault.createFolder(path);
    },
    async exists(path) {
      return vault.getAbstractFileByPath(path) != null;
    },
  };
}

/** Bridge: EntityRegistry-backed ContentLookupPort ({{type:slug}} resolution). */
export function makeRegistryContentPort(registry: EntityRegistry): ContentLookupPort {
  return { lookup: (type, slug) => registry.getByTypeAndSlug(type, slug)?.data };
}

/** Bridge: Obsidian Notice-backed NotificationSink. */
export function makeNoticeSink(): NotificationSink {
  return { info: (m) => new Notice(m), error: (m) => new Notice(m) };
}
