import * as yaml from "js-yaml";
import type { Vault } from "obsidian";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export type FrontmatterTransform = (
  fm: Record<string, unknown>,
  filePath: string,
) => Record<string, unknown>;

/**
 * Walk a folder recursively, parse each file's frontmatter, run the
 * transform, and rewrite the file when the frontmatter actually changes.
 * Body content is preserved verbatim. Files without parseable frontmatter
 * are skipped. Returns the count of files that were rewritten.
 */
export async function rewriteFrontmatter(
  vault: Vault,
  folder: string,
  transform: FrontmatterTransform,
): Promise<number> {
  let count = 0;
  const files = await listMarkdownFiles(vault, folder);
  for (const file of files) {
    const content = await vault.adapter.read(file);
    const match = FRONTMATTER_RE.exec(content);
    if (!match) continue;
    let fm: Record<string, unknown>;
    try {
      const loaded = yaml.load(match[1]) as Record<string, unknown> | null;
      fm = loaded ?? {};
    } catch {
      continue;
    }
    const next = transform({ ...fm }, file);
    if (JSON.stringify(next) === JSON.stringify(fm)) continue;
    const nextYaml = yaml.dump(next, { lineWidth: -1, noRefs: true }).trimEnd();
    const newContent = `---\n${nextYaml}\n---\n${match[2]}`;
    await vault.adapter.write(file, newContent);
    count++;
  }
  return count;
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
