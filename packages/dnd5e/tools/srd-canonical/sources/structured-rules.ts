import * as fs from "node:fs";
import * as path from "node:path";
import { slugifyName, editionPrefix } from "./slug-normalize";

export type StructuredRulesKind =
  | "feats" | "backgrounds" | "races" | "classes"
  | "items" | "spells" | "magicitems" | "weapons" | "armor"
  | "optionalfeatures" | "magicvariants" | "conditions";

const KIND_TO_FILE: Record<StructuredRulesKind, string> = {
  feats: "feats.json",
  backgrounds: "backgrounds.json",
  races: "races.json",
  classes: "class/index.json",        // per-class files; require special handling
  items: "items.json",
  spells: "spells/index.json",
  magicitems: "items.json",            // magic items are subset of items.json (rarity field)
  weapons: "items-base.json",
  armor: "items-base.json",
  optionalfeatures: "optionalfeatures.json",
  magicvariants: "magicvariants.json",
  conditions: "conditionsdiseases.json",
};

const KIND_TO_ROOT_KEY: Partial<Record<StructuredRulesKind, string>> = {
  feats: "feat",
  backgrounds: "background",
  races: "race",
  items: "item",
  magicitems: "item",
  weapons: "baseitem",
  armor: "baseitem",
  optionalfeatures: "optionalfeature",
  magicvariants: "magicvariant",
  conditions: "condition",
};

export interface StructuredRulesOptions {
  kind: StructuredRulesKind;
  edition: "2014" | "2024";
  rootPath: string;
  slugSet: Set<string>;
}

export interface StructuredEntry {
  name: string;
  source: string;
  edition?: "2014" | "2024";
  [key: string]: unknown;
}

function isSourceForEdition(source: string, edition: "2014" | "2024"): boolean {
  // Source-tag convention: PHB/MM/etc → 2014; XPHB/XMM/etc → 2024.
  if (edition === "2024") return source.startsWith("X");
  return !source.startsWith("X");
}

export function readStructuredRules(opts: StructuredRulesOptions): Promise<StructuredEntry[]> {
  const file = KIND_TO_FILE[opts.kind];
  const rootKey = KIND_TO_ROOT_KEY[opts.kind];
  if (!rootKey) {
    return readKindFromIndex(opts);
  }
  const filePath = path.join(opts.rootPath, file);
  if (!fs.existsSync(filePath)) return Promise.resolve([]);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const all = (raw[rootKey] ?? []) as StructuredEntry[];
  const prefix = editionPrefix(opts.edition);
  // Conditions have no Open5e-derived slug filter (Open5e exposes 0 for SRD
  // documents). Treat the structured-rules dump as source-of-truth and gate
  // by the per-entry SRD flag instead. 2014 entries carry `srd:true`; 2024
  // entries carry `srd52:true`.
  const useStructuredSrdFlag = opts.kind === "conditions";
  const filtered = all.filter(e => {
    if (!isSourceForEdition(e.source, opts.edition)) return false;
    if (useStructuredSrdFlag) {
      const flag = opts.edition === "2014"
        ? (e as { srd?: boolean }).srd
        : (e as { srd52?: boolean }).srd52;
      return flag === true;
    }
    const slug = prefix + slugifyName(e.name);
    return opts.slugSet.has(slug);
  });
  return Promise.resolve(filtered);
}

function readKindFromIndex(opts: StructuredRulesOptions): Promise<StructuredEntry[]> {
  // Per-file aggregated kinds (classes split per-class file, spells split per-source).
  const dir = path.join(opts.rootPath, opts.kind === "classes" ? "class" : "spells");
  if (!fs.existsSync(dir)) return Promise.resolve([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("foundry-") && !f.startsWith("index"));
  const all: StructuredEntry[] = [];
  const rootKey = opts.kind === "classes" ? "class" : "spell";
  const prefix = editionPrefix(opts.edition);
  for (const f of files) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Record<string, unknown>;
    const list = (json[rootKey] ?? []) as StructuredEntry[];
    for (const e of list) {
      if (!isSourceForEdition(e.source, opts.edition)) continue;
      if (opts.slugSet.has(prefix + slugifyName(e.name))) all.push(e);
    }
  }
  return Promise.resolve(all);
}
