import * as fs from "node:fs";
import * as path from "node:path";

export type Open5eKind =
  | "classes" | "races" | "species"
  | "feats" | "backgrounds"
  | "spells" | "magicitems" | "weapons" | "armor"
  | "monsters" | "conditions";

export interface Open5eEntry {
  key: string;
  name: string;
  document?: { key: string; name: string };
  [key: string]: unknown;
}

export interface ReadOpen5eOptions {
  kind: Open5eKind;
  edition: "2014" | "2024";
  apiBase: string;
  cacheDir: string;
  refresh: boolean;
}

const KIND_PATH: Record<Open5eKind, string> = {
  classes: "classes",
  races: "races",
  species: "species",
  feats: "feats",
  backgrounds: "backgrounds",
  spells: "spells",
  magicitems: "magicitems",
  weapons: "weapons",
  armor: "armor",
  monsters: "monsters",
  conditions: "conditions",
};

function cacheFilePath(opts: ReadOpen5eOptions): string {
  return path.join(opts.cacheDir, `${opts.kind}.${opts.edition}.json`);
}

export async function readOpen5eKind(opts: ReadOpen5eOptions): Promise<Open5eEntry[]> {
  const cachePath = cacheFilePath(opts);
  if (!opts.refresh && fs.existsSync(cachePath)) {
    const raw = JSON.parse(fs.readFileSync(cachePath, "utf8")) as { count: number; results: Open5eEntry[] };
    return raw.results;
  }

  const docKey = `srd-${opts.edition}`;
  const all: Open5eEntry[] = [];
  let url: string | null = `${opts.apiBase}/${KIND_PATH[opts.kind]}/?document__key__in=${docKey}&limit=200`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open5e fetch failed: ${res.status} ${url}`);
    const json = await res.json() as { count: number; next: string | null; results: Open5eEntry[] };
    all.push(...json.results);
    url = json.next;
  }

  fs.mkdirSync(opts.cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ count: all.length, results: all }, null, 2));
  return all;
}

export function deriveSlugSet(entries: Open5eEntry[]): Set<string> {
  return new Set(entries.map(e => e.key));
}
