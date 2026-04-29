#!/usr/bin/env tsx
import { loadConfig } from "./config";
import { readOpen5eKind, deriveSlugSet, type Open5eKind } from "./sources/open-srd";

const ALL_KINDS: Open5eKind[] = [
  "classes", "races", "feats", "backgrounds",
  "spells", "magicitems", "weapons", "armor",
  "monsters", "conditions",
];

async function main() {
  const cfg = loadConfig();
  console.log("[canonical] starting build", { editions: cfg.editions });

  for (const edition of cfg.editions) {
    const slugSetByKind = new Map<Open5eKind, Set<string>>();
    for (const kind of ALL_KINDS) {
      const entries = await readOpen5eKind({
        kind,
        edition,
        apiBase: cfg.open5eApi,
        cacheDir: cfg.open5eCacheDir,
        refresh: cfg.refreshOpen5e,
      });
      slugSetByKind.set(kind, deriveSlugSet(entries));
      console.log(`[canonical] ${edition} ${kind}: ${entries.length} entries`);
    }
  }

  console.log("[canonical] (downstream stages populated by subsequent phases)");
}

main().catch(e => { console.error(e); process.exit(1); });
