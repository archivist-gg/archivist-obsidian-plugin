// scripts/regenerate-srd-monsters.ts

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { convertDescToTags } from "../src/shared/dnd/srd-tag-converter";

const SRD_JSON_DIR = "/Users/shinoobi/w/archivist/server/data/srd/monsters";
const COMPENDIUM_MD_DIR = "/Users/shinoobi/Documents/V/Compendium/SRD/Monsters";

interface MonsterJson {
  name: string;
  slug?: string;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  challenge_rating?: string | number;
  actions?: Array<{ name?: string; desc?: string }>;
  reactions?: Array<{ name?: string; desc?: string }>;
  legendary_actions?: Array<{ name?: string; desc?: string }>;
  special_abilities?: Array<{ name?: string; desc?: string }>;
  [k: string]: unknown;
}

function profBonusFromCR(cr: string | number | undefined): number {
  const num = typeof cr === "string" ? Number(cr) : cr ?? 0;
  if (num <= 4) return 2;
  if (num <= 8) return 3;
  if (num <= 12) return 4;
  if (num <= 16) return 5;
  if (num <= 20) return 6;
  if (num <= 24) return 7;
  if (num <= 28) return 8;
  return 9;
}

function abilityScoresOf(m: MonsterJson) {
  return {
    str: m.strength ?? 10,
    dex: m.dexterity ?? 10,
    con: m.constitution ?? 10,
    int: m.intelligence ?? 10,
    wis: m.wisdom ?? 10,
    cha: m.charisma ?? 10,
  };
}

function processActions(
  actions: Array<{ name?: string; desc?: string }> | undefined,
  abilities: ReturnType<typeof abilityScoresOf>,
  profBonus: number,
): Array<{ name?: string; entries?: string[] }> {
  if (!actions) return [];
  return actions.map((a) => {
    const desc = a.desc ?? "";
    const converted = convertDescToTags(desc, {
      abilities,
      profBonus,
      actionName: a.name ?? "",
      actionCategory: "action",
    });
    return { name: a.name, entries: [converted] };
  });
}

function buildMarkdown(m: MonsterJson): string {
  const abilities = abilityScoresOf(m);
  const profBonus = profBonusFromCR(m.challenge_rating);
  const slug = m.slug ?? m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const yamlData: Record<string, unknown> = {
    name: m.name,
    slug,
    abilities,
    challenge_rating: m.challenge_rating,
    actions: processActions(m.actions, abilities, profBonus),
  };
  if (m.reactions) yamlData.reactions = processActions(m.reactions, abilities, profBonus);
  if (m.legendary_actions) yamlData.legendary_actions = processActions(m.legendary_actions, abilities, profBonus);
  if (m.special_abilities) yamlData.special_abilities = processActions(m.special_abilities, abilities, profBonus);

  // Preserve other monster fields that aren't action-list shaped.
  for (const [k, v] of Object.entries(m)) {
    if (k in yamlData) continue;
    if (["actions", "reactions", "legendary_actions", "special_abilities"].includes(k)) continue;
    yamlData[k] = v;
  }

  const frontmatter = yaml.dump(
    { archivist: true, entity_type: "monster", slug, name: m.name, compendium: "SRD" },
    { lineWidth: 999 },
  );
  const body = yaml.dump(yamlData, { lineWidth: 999, quotingType: "'" });

  return `---\n${frontmatter}---\n\n\`\`\`monster\n${body}\`\`\`\n`;
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
    const json = JSON.parse(fs.readFileSync(path.join(SRD_JSON_DIR, file), "utf-8")) as MonsterJson;
    const markdown = buildMarkdown(json);
    const targetName = `${json.name.replace(/[\/\\:]/g, "_")}.md`;
    const targetPath = path.join(COMPENDIUM_MD_DIR, targetName);
    fs.writeFileSync(targetPath, markdown, "utf-8");
    written++;
  }

  console.log(`Wrote ${written} files to ${COMPENDIUM_MD_DIR}`);
}

main();
