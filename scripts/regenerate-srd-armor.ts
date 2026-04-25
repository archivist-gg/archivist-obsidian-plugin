// scripts/regenerate-srd-armor.ts

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { normalizeSrdArmor } from "../src/shared/entities/srd-normalizer";

const SRD_JSON_DIR = "/Users/shinoobi/w/archivist/server/data/srd/armor";
const COMPENDIUM_MD_DIR = "/Users/shinoobi/Documents/V/Compendium/SRD/Armor";

function buildMarkdown(json: Record<string, unknown>): string {
  const name = String(json.name);
  const slug = typeof json.slug === "string" && json.slug.length > 0
    ? json.slug
    : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const normalized = normalizeSrdArmor(json);
  const body: Record<string, unknown> = { name: normalized.name ?? name, slug };
  for (const [k, v] of Object.entries(normalized)) {
    if (k === "name" || k === "slug") continue;
    body[k] = v;
  }

  const frontmatter = yaml.dump(
    { archivist: true, entity_type: "armor", slug, name, compendium: "SRD" },
    { lineWidth: 999 },
  );
  const bodyYaml = yaml.dump(body, { lineWidth: 999, quotingType: "'" });

  return `---\n${frontmatter}---\n\n\`\`\`armor\n${bodyYaml}\`\`\`\n`;
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
  console.log(`Processing ${files.length} armor files...`);

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
