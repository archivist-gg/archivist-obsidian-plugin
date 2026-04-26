// scripts/regenerate-srd-magicitems.ts
//
// Admin/maintenance script: rewrites the user's vault Magic Item compendium
// from the bundled (and possibly augmented) `src/srd/data/magicitems.json`.
//
// Unlike `entity-importer.importSrdToVault`, which skips files that already
// exist, this script overwrites — its purpose is exactly to refresh the
// bundled SRD content (e.g., after structured-fields augmentation).
//
// Safety: only files whose frontmatter matches the SRD-bundle shape are
// overwritten. User-customized notes are detected via extra frontmatter
// keys and skipped.
//
// Usage:
//   npx tsx scripts/regenerate-srd-magicitems.ts

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { normalizeSrdItem } from "../src/shared/entities/srd-normalizer";
import { generateEntityMarkdown, slugify } from "../src/shared/entities/entity-vault-store";

const REPO_ROOT = path.resolve(__dirname, "..");
const SRD_JSON_PATH = path.join(REPO_ROOT, "src/srd/data/magicitems.json");
const COMPENDIUM_MD_DIR = "/Users/shinoobi/Documents/V/Compendium/SRD/Magic Items";

// Frontmatter keys that the SRD bundle writes — anything else (in addition
// to these) on an existing note signals user customization.
const ALLOWED_FRONTMATTER_KEYS = new Set([
  "archivist",
  "entity_type",
  "slug",
  "name",
  "compendium",
]);

interface OpenItemRecord {
  name: string;
  [k: string]: unknown;
}

/**
 * Returns true when the existing note's frontmatter matches what the SRD
 * bundle writes (no user customizations) and is therefore safe to overwrite.
 * Returns true for non-existent files (write a new one) and false when the
 * note appears user-customized or unparseable.
 */
function isSafeToOverwrite(targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return true;
  let content: string;
  try {
    content = fs.readFileSync(targetPath, "utf-8");
  } catch {
    return false;
  }
  if (!content.startsWith("---\n")) return false;
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) return false;
  const yamlBlock = content.substring(4, endIndex);
  let parsed: Record<string, unknown>;
  try {
    parsed = yaml.load(yamlBlock) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  if (parsed.archivist !== true) return false;
  if (parsed.compendium !== "SRD") return false;
  // Any extra frontmatter key beyond the canonical bundle set means a user
  // customized this note — skip.
  for (const k of Object.keys(parsed)) {
    if (!ALLOWED_FRONTMATTER_KEYS.has(k)) return false;
  }
  return true;
}

function buildMarkdown(item: OpenItemRecord): string {
  const name = String(item.name);
  const slug = typeof item.slug === "string" && item.slug.length > 0
    ? item.slug
    : slugify(name);

  const normalized = normalizeSrdItem(item);
  // Build the body record; ensure name and slug are first, then everything else.
  const body: Record<string, unknown> = { name: normalized.name ?? name, slug };
  for (const [k, v] of Object.entries(normalized)) {
    if (k === "name" || k === "slug") continue;
    body[k] = v;
  }

  return generateEntityMarkdown({
    slug,
    name,
    entityType: "item",
    compendium: "SRD",
    data: body,
  });
}

function main(): void {
  if (!fs.existsSync(SRD_JSON_PATH)) {
    console.error(`Bundled data not found: ${SRD_JSON_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(COMPENDIUM_MD_DIR)) {
    console.error(`Target directory not found: ${COMPENDIUM_MD_DIR}`);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(SRD_JSON_PATH, "utf-8")) as OpenItemRecord[];
  console.log(`Processing ${items.length} magic items...`);

  let written = 0;
  let skipped = 0;
  for (const item of items) {
    const name = String(item.name);
    const targetName = `${name.replace(/[\/\\:]/g, "_")}.md`;
    const targetPath = path.join(COMPENDIUM_MD_DIR, targetName);
    if (!isSafeToOverwrite(targetPath)) {
      console.log(`  skip (user-customized): ${targetName}`);
      skipped++;
      continue;
    }
    const markdown = buildMarkdown(item);
    fs.writeFileSync(targetPath, markdown, "utf-8");
    written++;
  }

  console.log(`Wrote ${written} files; skipped ${skipped} files; target ${COMPENDIUM_MD_DIR}`);
}

main();
