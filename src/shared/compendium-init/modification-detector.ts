import * as yaml from "js-yaml";
import type { Vault } from "obsidian";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export interface ModificationDetectorOptions {
  vault: Vault;
  /** Folder to scan recursively (e.g. "Compendium/SRD"). */
  folder: string;
  /**
   * Frontmatter keys we expect on plugin-managed notes. Any other top-level
   * key in a note's frontmatter is treated as a user modification.
   */
  knownFrontmatterKeys: string[];
}

/**
 * Walk a folder recursively and return paths of files the user has likely
 * modified. A file is reported as modified if EITHER:
 *  - its frontmatter has a top-level key not in `knownFrontmatterKeys`, OR
 *  - its body (everything after the closing fence) has non-whitespace text
 *    outside fenced code blocks. The readonly bundle template emits an empty
 *    body with only a codeblock, so any extra prose is a user edit.
 * Files without a parseable frontmatter block are reported (malformed).
 */
export async function detectModifiedFiles(
  opts: ModificationDetectorOptions,
): Promise<string[]> {
  const modified: string[] = [];
  const known = new Set(opts.knownFrontmatterKeys);
  const files = await listMarkdownFiles(opts.vault, opts.folder);
  for (const file of files) {
    const content = await opts.vault.adapter.read(file);
    const match = FRONTMATTER_RE.exec(content);
    if (!match) {
      modified.push(file);
      continue;
    }
    let flaggedByFrontmatter = false;
    try {
      const fm = yaml.load(match[1]) as Record<string, unknown> | null;
      if (fm) {
        for (const key of Object.keys(fm)) {
          if (!known.has(key)) {
            modified.push(file);
            flaggedByFrontmatter = true;
            break;
          }
        }
      }
    } catch {
      modified.push(file);
      continue;
    }
    if (flaggedByFrontmatter) continue;
    const body = match[2];
    const codeBlockStripped = body.replace(/```[\s\S]*?```/g, "").trim();
    if (codeBlockStripped.length > 0) modified.push(file);
  }
  return modified;
}

async function listMarkdownFiles(vault: Vault, folder: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await vault.adapter.exists(folder))) return out;
  const list = await vault.adapter.list(folder);
  for (const f of list.files) {
    if (f.endsWith(".md")) out.push(f);
  }
  for (const sub of list.folders) {
    out.push(...(await listMarkdownFiles(vault, sub)));
  }
  return out;
}
