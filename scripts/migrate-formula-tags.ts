// scripts/migrate-formula-tags.ts

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { convertDescToTags } from "../src/shared/dnd/srd-tag-converter";

interface MonsterStatBlock {
  abilities?: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
  challenge_rating?: number | string;
  actions?: Array<{ name?: string; entries?: string[] }>;
  reactions?: Array<{ name?: string; entries?: string[] }>;
  legendary_actions?: Array<{ name?: string; entries?: string[] }>;
  [k: string]: unknown;
}

function profBonusFromCR(cr: string | number | undefined): number {
  const num = typeof cr === "string" ? Number(cr) : cr ?? 0;
  if (num <= 4) return 2;
  if (num <= 8) return 3;
  if (num <= 12) return 4;
  if (num <= 16) return 5;
  if (num <= 20) return 6;
  return 7;
}

function migrateActions(
  actions: Array<{ name?: string; entries?: string[] }> | undefined,
  abilities: NonNullable<MonsterStatBlock["abilities"]>,
  profBonus: number,
): boolean {
  if (!actions) return false;
  let changed = false;
  for (const a of actions) {
    if (!a.entries) continue;
    a.entries = a.entries.map((entry) => {
      const converted = convertDescToTags(entry, {
        abilities: {
          str: abilities.str ?? 10,
          dex: abilities.dex ?? 10,
          con: abilities.con ?? 10,
          int: abilities.int ?? 10,
          wis: abilities.wis ?? 10,
          cha: abilities.cha ?? 10,
        },
        profBonus,
        actionName: a.name ?? "",
        actionCategory: "action",
      });
      if (converted !== entry) changed = true;
      return converted;
    });
  }
  return changed;
}

export function migrateMonsterFile(filePath: string): boolean {
  const text = fs.readFileSync(filePath, "utf-8");
  const codeBlockRe = /```monster\n([\s\S]*?)```/;
  const m = text.match(codeBlockRe);
  if (!m) return false;

  const yamlBody = m[1];
  let parsed: MonsterStatBlock;
  try {
    parsed = yaml.load(yamlBody) as MonsterStatBlock;
  } catch {
    console.warn(`skipping ${filePath}: YAML parse failed`);
    return false;
  }

  if (!parsed.abilities) {
    console.warn(`skipping ${filePath}: no abilities block`);
    return false;
  }
  const profBonus = profBonusFromCR(parsed.challenge_rating);

  let changed = false;
  changed = migrateActions(parsed.actions, parsed.abilities, profBonus) || changed;
  changed = migrateActions(parsed.reactions, parsed.abilities, profBonus) || changed;
  changed = migrateActions(parsed.legendary_actions, parsed.abilities, profBonus) || changed;

  if (!changed) return false;

  const newYaml = yaml.dump(parsed, { lineWidth: 999, quotingType: "'" });
  const newText = text.replace(codeBlockRe, "```monster\n" + newYaml + "```");
  fs.writeFileSync(filePath, newText, "utf-8");
  return true;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: npx tsx scripts/migrate-formula-tags.ts <directory>");
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f));
  let migrated = 0;
  for (const f of files) {
    if (migrateMonsterFile(f)) {
      console.log(`migrated: ${f}`);
      migrated++;
    }
  }
  console.log(`\nMigrated ${migrated}/${files.length} files`);
}

if (require.main === module) main();
