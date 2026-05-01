import * as fs from "node:fs";
import * as path from "node:path";
import { slugifyName, editionPrefix } from "./slug-normalize";

const FOUNDRY_FILE: Record<string, string> = {
  feats: "foundry-feats.json",
  races: "foundry-races.json",
  optionalfeatures: "foundry-optionalfeatures.json",
  items: "foundry-items.json",
  magicitems: "foundry-items.json",
};

const ROOT_KEY: Record<string, string> = {
  feats: "feat",
  races: "race",
  optionalfeatures: "optionalfeature",
  items: "item",
  magicitems: "item",
};

export interface ActivationEntry {
  activation?: { type: string; value: number };
  save?: { ability: string; dc?: { calculation?: string } };
  damage?: { parts: unknown[] };
  target?: unknown;
  range?: unknown;
}

export interface ReadActivationOptions {
  kind: string;
  edition: "2014" | "2024";
  rootPath: string;
  slugSet: Set<string>;
}

export function readActivationData(opts: ReadActivationOptions): Promise<Map<string, ActivationEntry>> {
  const fileName = FOUNDRY_FILE[opts.kind];
  const rootKey = ROOT_KEY[opts.kind];
  if (!fileName || !rootKey) return Promise.resolve(new Map<string, ActivationEntry>());
  const filePath = path.join(opts.rootPath, fileName);
  if (!fs.existsSync(filePath)) return Promise.resolve(new Map<string, ActivationEntry>());

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const list = (raw[rootKey] ?? []) as Array<{ name: string; source: string; system?: Record<string, unknown> }>;

  const prefix = editionPrefix(opts.edition);
  const out = new Map<string, ActivationEntry>();
  for (const e of list) {
    const slug = prefix + slugifyName(e.name);
    if (!opts.slugSet.has(slug)) continue;
    if (!e.system) continue;
    const activities = (e.system.activities ?? {}) as Record<string, ActivationEntry>;
    const first = Object.values(activities)[0];
    if (first) out.set(slug, first);
  }
  return Promise.resolve(out);
}
