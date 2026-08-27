import { TFile, TFolder } from "obsidian";
import type { Vault, FileManager, TAbstractFile } from "obsidian";

export type ActionEvent = { kind: "write" | "process" | "trash"; path: string };

export interface Harness {
  vault: Vault;
  fileManager: FileManager;
  /** The "disk". */
  files: Map<string, string>;
  folders: Set<string>;
  /** One ordered log of every adapter write, every vault.process, every trashFile (spec §9). */
  log: ActionEvent[];
  /** Rebuild the TFolder/TFile index and the cachedRead cache from the disk. Adapter writes
   *  are invisible to getAbstractFileByPath and cachedRead until this is called (models
   *  Obsidian's watcher lag conservatively); process() updates both immediately. */
  reindex(): void;
  trashThrowsFor(path: string | null): void;
  /** Make the adapter's `read` or `write` reject for exactly this path (null clears). Lets a
   *  guard fault ONE compendium's copy or plan read without monkey-patching the vault. */
  adapterThrowsFor(op: "read" | "write", path: string | null): void;
  fileOf(path: string): TFile | null;
}

function ancestors(path: string): string[] {
  const parts = path.split("/");
  parts.pop();
  const out: string[] = [];
  for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

export function makeHarness(initial: Record<string, string>): Harness {
  const files = new Map(Object.entries(initial));
  const folders = new Set<string>();
  for (const p of files.keys()) for (const a of ancestors(p)) folders.add(a);
  const cache = new Map<string, string>();
  const index = new Map<string, TAbstractFile>();
  const log: ActionEvent[] = [];
  let throwFor: string | null = null;
  const adapterThrows: { read: string | null; write: string | null } = { read: null, write: null };

  const reindex = (): void => {
    index.clear();
    cache.clear();
    const root = new TFolder();
    root.name = "";
    root.path = "";
    index.set("", root);
    const folderOf = (p: string): TFolder => {
      const hit = index.get(p);
      if (hit instanceof TFolder) return hit;
      const f = new TFolder();
      const parts = p.split("/");
      f.name = parts[parts.length - 1];
      f.path = p;
      f.parent = folderOf(parts.slice(0, -1).join("/"));
      f.parent.children.push(f);
      index.set(p, f);
      return f;
    };
    for (const p of [...folders].sort()) folderOf(p);
    for (const [p, content] of files) {
      const t = new TFile();
      const parts = p.split("/");
      t.name = parts[parts.length - 1];
      t.path = p;
      t.extension = t.name.includes(".") ? t.name.slice(t.name.lastIndexOf(".") + 1) : "";
      t.basename = t.extension ? t.name.slice(0, -(t.extension.length + 1)) : t.name;
      t.parent = folderOf(parts.slice(0, -1).join("/"));
      t.parent.children.push(t);
      index.set(p, t);
      cache.set(p, content);
    }
  };

  const adapter = {
    exists: async (p: string) => p === "" || files.has(p) || folders.has(p),
    read: async (p: string) => {
      if (adapterThrows.read === p) throw new Error(`EACCES: ${p}`);
      const c = files.get(p);
      if (c === undefined) throw new Error(`ENOENT: ${p}`);
      return c;
    },
    write: async (p: string, c: string) => {
      if (adapterThrows.write === p) throw new Error(`disk full: ${p}`);
      files.set(p, c);
      for (const a of ancestors(p)) folders.add(a);
      log.push({ kind: "write", path: p });
    },
    mkdir: async (p: string) => { folders.add(p); },
    list: async (p: string) => {
      const prefix = p === "" ? "" : p + "/";
      const childFiles = [...files.keys()].filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/"));
      const childFolders = [...folders].filter((f) => f !== p && f.startsWith(prefix) && !f.slice(prefix.length).includes("/"));
      return { files: childFiles, folders: childFolders };
    },
  };

  const vault = {
    adapter,
    getAbstractFileByPath: (p: string) => index.get(p) ?? null,
    read: async (file: TFile) => {
      const c = files.get(file.path);
      if (c === undefined) throw new Error(`ENOENT: ${file.path}`);
      return c;
    },
    cachedRead: async (file: TFile) => {
      const c = cache.get(file.path);
      if (c === undefined) throw new Error(`not indexed: ${file.path}`);
      return c;
    },
    process: async (file: TFile, fn: (data: string) => string) => {
      const cur = files.get(file.path);
      if (cur === undefined) throw new Error(`ENOENT: ${file.path}`);
      const next = fn(cur);
      files.set(file.path, next);
      cache.set(file.path, next);
      log.push({ kind: "process", path: file.path });
      return next;
    },
  } as unknown as Vault;

  const fileManager = {
    trashFile: async (file: TAbstractFile) => {
      if (throwFor === file.path) throw new Error(`trash refused: ${file.path}`);
      files.delete(file.path);
      cache.delete(file.path);
      const parent = file.parent;
      if (parent) parent.children = parent.children.filter((c) => c !== file);
      index.delete(file.path);
      log.push({ kind: "trash", path: file.path });
    },
  } as unknown as FileManager;

  reindex();
  return {
    vault, fileManager, files, folders, log, reindex,
    trashThrowsFor: (p) => { throwFor = p; },
    adapterThrowsFor: (op, p) => { adapterThrows[op] = p; },
    fileOf: (p) => { const f = index.get(p); return f instanceof TFile ? f : null; },
  };
}
