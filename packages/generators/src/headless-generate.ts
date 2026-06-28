import yaml from "js-yaml";
import type { Generatable, DocCodec, StoragePort } from "@archivist/core";

export async function generateToFile(opts: {
  generatable: Generatable; codec: DocCodec; input: unknown;
  folder: string; slug: string; storage: StoragePort; frontmatter?: Record<string, unknown>;
}): Promise<string> {
  const raw = opts.generatable.enrich(opts.input);
  const body = opts.codec.serialize(raw);
  const fm = opts.frontmatter ? `---\n${yaml.dump(opts.frontmatter)}---\n\n` : "";
  const text = `${fm}\`\`\`${opts.generatable.type}\n${body}\`\`\`\n`;
  await opts.storage.ensureFolder(opts.folder);
  const path = `${opts.folder}/${opts.slug}.md`;
  await opts.storage.write(path, text);
  return path;
}
