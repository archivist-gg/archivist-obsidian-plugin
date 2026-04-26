// scripts/inspect-augmented-bonuses.ts
//
// One-shot helper that reads src/srd/data/magicitems.json and prints
// the bonuses field for a configurable list of items by slug or name.
// Used during plan verification.

import * as fs from "fs";
import * as path from "path";

const SRD_PATH = path.resolve(__dirname, "..", "src/srd/data/magicitems.json");
const SAMPLE_SLUGS = [
  "bracers-of-defense",
  "arrow-catching-shield",
  "sun-blade",
  "cloak-of-protection",
  "cloak-of-the-manta-ray",
];

interface ItemRecord { name?: string; slug?: string; bonuses?: unknown }

const data = JSON.parse(fs.readFileSync(SRD_PATH, "utf-8")) as ItemRecord[];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

for (const target of SAMPLE_SLUGS) {
  const it = data.find((x) => x.slug === target || (x.name && slugify(x.name) === target));
  console.log(`${target}: ${JSON.stringify(it?.bonuses ?? null)}`);
}
