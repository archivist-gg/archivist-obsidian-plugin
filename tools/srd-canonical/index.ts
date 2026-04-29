#!/usr/bin/env tsx
import { loadConfig } from "./config";
import { readOpen5eKind, deriveSlugSet, type Open5eKind } from "./sources/open-srd";
import { readStructuredRules, type StructuredRulesKind } from "./sources/structured-rules";

const ALL_KINDS: Open5eKind[] = [
  "classes", "species", "feats", "backgrounds",
  "spells", "magicitems", "weapons", "armor",
  "creatures", "conditions",
];

const KIND_MAP: Partial<Record<Open5eKind, StructuredRulesKind>> = {
  classes: "classes",
  species: "races",
  feats: "feats",
  backgrounds: "backgrounds",
  spells: "spells",
  magicitems: "magicitems",
  weapons: "weapons",
  armor: "armor",
};

async function main() {
  const cfg = loadConfig();
  console.log("[canonical] starting build", { editions: cfg.editions });

  for (const edition of cfg.editions) {
    const slugSetByKind = new Map<Open5eKind, Set<string>>();
    for (const kind of ALL_KINDS) {
      const open5e = await readOpen5eKind({
        kind,
        edition,
        apiBase: cfg.open5eApi,
        cacheDir: cfg.open5eCacheDir,
        refresh: cfg.refreshOpen5e,
      });
      const slugSet = deriveSlugSet(open5e);
      slugSetByKind.set(kind, slugSet);
      console.log(`[canonical] ${edition} ${kind}: ${open5e.length} entries`);

      const structuredKind = KIND_MAP[kind];
      if (structuredKind) {
        const structured = await readStructuredRules({
          kind: structuredKind,
          edition,
          rootPath: cfg.structuredRulesPath,
          slugSet,
        });
        console.log(`[canonical]   structured: ${structured.length} of ${open5e.length} matched`);
      }
    }
  }

  console.log("[canonical] (downstream stages populated by subsequent phases)");
}

main().catch(e => { console.error(e); process.exit(1); });
