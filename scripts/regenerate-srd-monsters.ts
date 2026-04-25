// scripts/regenerate-srd-monsters.ts

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { normalizeSrdMonster } from "../src/shared/entities/srd-normalizer";

const SRD_JSON_DIR = "/Users/shinoobi/w/archivist/server/data/srd/monsters";
const COMPENDIUM_MD_DIR = "/Users/shinoobi/Documents/V/Compendium/SRD/Monsters";

function buildMarkdown(json: Record<string, unknown>): string {
  const name = String(json.name);
  const slug = typeof json.slug === "string" && json.slug.length > 0
    ? json.slug
    : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const normalized = normalizeSrdMonster(json);
  // Place slug right after name in the body (cosmetic — matches existing convention).
  const body: Record<string, unknown> = { name: normalized.name ?? name, slug };
  for (const [k, v] of Object.entries(normalized)) {
    if (k === "name") continue;
    body[k] = v;
  }

  const frontmatter = yaml.dump(
    { archivist: true, entity_type: "monster", slug, name, compendium: "SRD" },
    { lineWidth: 999 },
  );
  const bodyYaml = yaml.dump(body, { lineWidth: 999, quotingType: "'" });

  return `---\n${frontmatter}---\n\n\`\`\`monster\n${bodyYaml}\`\`\`\n`;
}

function main() {
  if (!fs.existsSync(SRD_JSON_DIR)) {
    console.error(`Source directory not found: ${SRD_JSON_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(COMPENDIUM_MD_DIR)) {
    console.error(`Target directory not found: ${COMPENDIUM_MD_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SRD_JSON_DIR).filter((f) => f.endsWith(".json") && f !== "all.json");
  console.log(`Processing ${files.length} monster files...`);

  let written = 0;
  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(path.join(SRD_JSON_DIR, file), "utf-8")) as Record<string, unknown>;
    const markdown = buildMarkdown(json);
    const targetName = `${String(json.name).replace(/[\/\\:]/g, "_")}.md`;
    const targetPath = path.join(COMPENDIUM_MD_DIR, targetName);
    fs.writeFileSync(targetPath, markdown, "utf-8");
    written++;
  }

  console.log(`Wrote ${written} files to ${COMPENDIUM_MD_DIR}`);
}

main();
