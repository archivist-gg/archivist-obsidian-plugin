#!/usr/bin/env tsx
import { loadConfig } from "./config";

// eslint-disable-next-line require-await -- placeholder; subsequent phases add awaited sub-stages
async function main() {
  const cfg = loadConfig();
  console.log("[canonical] starting build", { editions: cfg.editions });
  console.log("[canonical] (sub-stages not yet wired — populated by subsequent phases)");
  console.log("[canonical] config OK");
}

main().catch(e => { console.error(e); process.exit(1); });
