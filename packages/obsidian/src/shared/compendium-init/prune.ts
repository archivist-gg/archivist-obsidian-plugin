import * as yaml from "js-yaml";
import { TFile, TFolder, type Vault, type FileManager } from "obsidian";
import type { CompendiumBundle } from "./bundle-copier";

/**
 * The frontmatter every entity note the dnd5e generator emits carries, and nothing else
 * (measured over the shipped bundle by the tripwire test). `source` is the discriminator:
 * no plugin-authored writer (`generateEntityMarkdown`) has ever emitted it.
 */
export const BUNDLE_NOTE_FRONTMATTER_KEYS = ["archivist", "entity_type", "slug", "name", "compendium", "source"] as const;

/**
 * Keys older bundles stamped in addition. An orphan is never overwritten, so a note shipped
 * by any earlier bundle keeps its legacy key and must still qualify as pristine.
 */
export const LEGACY_BUNDLE_NOTE_KEYS = ["archivist_compendium_imported_at"] as const;

const INDEX_FILE = "_compendium.md";
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * The comparison key of the prune's keep set. Lower-casing is explicit and load-bearing: on a
 * case-insensitive volume (macOS APFS default, Windows) an adapter write to a case-variant
 * path overwrites the existing inode while the vault index keeps the old casing, so without
 * it a case-only rename between bundle versions would make the live note a candidate.
 * Nothing else is normalized: the compared strings are generator keys (ASCII, single forward
 * slashes, pinned by the bundle tripwires) joined to the once-normalized compendium root, and
 * Obsidian index paths, which are always forward-slash.
 */
export function keepKey(path: string): string {
  return path.toLowerCase();
}

/**
 * True when the note carries every bundle key, no key outside the bundle and legacy sets,
 * and no text outside fenced code blocks: the shape every note this plugin ever shipped has,
 * and one no plugin-authored or user-edited note has.
 */
export function isPristineBundleNote(content: string): boolean {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return false;
  let fm: unknown;
  try {
    fm = yaml.load(match[1]);
  } catch {
    return false;
  }
  if (!fm || typeof fm !== "object") return false;
  const keys = new Set(Object.keys(fm));   // fm is narrowed to object here; a cast would trip no-unnecessary-type-assertion
  for (const required of BUNDLE_NOTE_FRONTMATTER_KEYS) if (!keys.has(required)) return false;
  const allowed = new Set<string>([...BUNDLE_NOTE_FRONTMATTER_KEYS, ...LEGACY_BUNDLE_NOTE_KEYS]);
  for (const key of keys) if (!allowed.has(key)) return false;
  const outsideFences = match[2].replace(/```[\s\S]*?```/g, "").trim();
  return outsideFences.length === 0;
}

/**
 * Markdown files under `folder` (the compendium's own folder) that are not in `keep`,
 * skipping every `_compendium.md` and every subfolder that holds one (a nested compendium
 * `discover()` cannot see) and every non-markdown file. `keep` holds `keepKey` values.
 */
export function collectPruneCandidates(folder: TFolder, keep: Set<string>): TFile[] {
  const out: TFile[] = [];
  const walk = (dir: TFolder, isCompendiumRoot: boolean): void => {
    if (!isCompendiumRoot && dir.children.some((c) => c instanceof TFile && c.name === INDEX_FILE)) return;
    for (const child of dir.children) {
      if (child instanceof TFolder) {
        walk(child, false);
      } else if (child instanceof TFile) {
        if (child.name === INDEX_FILE || child.extension !== "md") continue;
        if (keep.has(keepKey(child.path))) continue;
        out.push(child);
      }
    }
  };
  walk(folder, true);
  return out;
}

export interface PruneReport {
  pruned: string[];
  keptModified: string[];
  pruneFailures: Array<{ path: string; error: string }>;
}

export interface PruneOptions {
  rootFolder: string;
  compendiumName: string;
  /** The compendium's sub-bundle (index entry included or not; the index is never a candidate). */
  bundle: CompendiumBundle;
}

/**
 * Trash (via the user's Deleted-files preference) every note under the compendium folder that
 * is not in the new bundle AND is a pristine bundle note; keep and report everything else.
 * Best effort per file: a failure is reported and never blocks the caller's version stamp.
 * Reads the disk (`vault.read`) for the destructive decision, never the cache.
 */
export async function pruneOrphans(vault: Vault, fileManager: FileManager, opts: PruneOptions): Promise<PruneReport> {
  const report: PruneReport = { pruned: [], keptModified: [], pruneFailures: [] };
  const folder = vault.getAbstractFileByPath(`${opts.rootFolder}/${opts.compendiumName}`);
  if (!(folder instanceof TFolder)) return report;
  // Entity keys only: the index file is protected by name in collectPruneCandidates, never by
  // membership here, so that protection stays independently observable.
  const keep = new Set(
    Object.keys(opts.bundle)
      .filter((key) => !key.endsWith(`/${INDEX_FILE}`))
      .map((key) => keepKey(`${opts.rootFolder}/${key}`)),
  );
  for (const file of collectPruneCandidates(folder, keep)) {
    try {
      if (!isPristineBundleNote(await vault.read(file))) {
        report.keptModified.push(file.path);
        continue;
      }
      await fileManager.trashFile(file);
      report.pruned.push(file.path);
    } catch (err) {
      report.pruneFailures.push({ path: file.path, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return report;
}
