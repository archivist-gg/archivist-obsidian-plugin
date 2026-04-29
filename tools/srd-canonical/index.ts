#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config";
import { readOpen5eKind, deriveSlugSet, type Open5eKind } from "./sources/open-srd";
import { readStructuredRules, type StructuredRulesKind, type StructuredEntry } from "./sources/structured-rules";
import { readActivationData } from "./sources/activation";
import { loadOverlay } from "./sources/overlay";
import { mergeKind, type MergeRule, type CanonicalEntry } from "./merger";

import { raceMergeRule, toRaceCanonical } from "./merger-rules/race-merge";
import { classMergeRule, toClassCanonical } from "./merger-rules/class-merge";
import { subclassMergeRule, toSubclassCanonical } from "./merger-rules/subclass-merge";
import { featMergeRule, toFeatCanonical } from "./merger-rules/feat-merge";
import { backgroundMergeRule, toBackgroundCanonical } from "./merger-rules/background-merge";
import { weaponMergeRule, toWeaponCanonical } from "./merger-rules/weapon-merge";
import { armorMergeRule, toArmorCanonical } from "./merger-rules/armor-merge";
import { itemMergeRule, toItemCanonical } from "./merger-rules/item-merge";
import { spellMergeRule, toSpellCanonical } from "./merger-rules/spell-merge";
import { creatureMergeRule, toCreatureCanonical } from "./merger-rules/creature-merge";
import { conditionMergeRule, toConditionCanonical } from "./merger-rules/condition-merge";
import { mergeOptionalFeatures } from "./merger-rules/optional-feature-merge";

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

// Per-kind merge rule + canonical mapper. The mapper is invoked on each
// CanonicalEntry produced by mergeKind. Optional features are dispatched
// separately because Open5e does not expose them.
const RULES_BY_KIND: Record<Open5eKind, { rule: MergeRule; toCanonical: (entry: CanonicalEntry) => unknown } | null> = {
  classes: { rule: classMergeRule, toCanonical: toClassCanonical },
  species: { rule: raceMergeRule, toCanonical: toRaceCanonical },
  feats: { rule: featMergeRule, toCanonical: toFeatCanonical },
  backgrounds: { rule: backgroundMergeRule, toCanonical: toBackgroundCanonical },
  spells: { rule: spellMergeRule, toCanonical: toSpellCanonical },
  magicitems: { rule: itemMergeRule, toCanonical: toItemCanonical },
  weapons: { rule: weaponMergeRule, toCanonical: toWeaponCanonical },
  armor: { rule: armorMergeRule, toCanonical: toArmorCanonical },
  creatures: { rule: creatureMergeRule, toCanonical: toCreatureCanonical },
  conditions: { rule: conditionMergeRule, toCanonical: toConditionCanonical },
};

// Subclasses are routed off the "classes" Open5e kind via subclass_of.
// Phase 9+ will fan them out; for now keep the imports live so the rule
// stays in the dependency graph and ready for that wiring.
void subclassMergeRule;
void toSubclassCanonical;

/**
 * Read the structured-rules optionalfeatures.json directly. The standard
 * structured-rules reader is gated on an Open5e-derived slug set, which
 * does not apply here — Open5e has no optional-feature endpoint, so the
 * overlay's slug map drives membership inside mergeOptionalFeatures.
 */
function readOptionalFeaturesRaw(rootPath: string, edition: "2014" | "2024"): StructuredEntry[] {
  const filePath = path.join(rootPath, "optionalfeatures.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { optionalfeature?: StructuredEntry[] };
  const all = raw.optionalfeature ?? [];
  return all.filter(e => {
    if (!e.source) return false;
    const isXSource = e.source.startsWith("X");
    return edition === "2024" ? isXSource : !isXSource;
  });
}

async function main() {
  const cfg = loadConfig();
  console.log("[canonical] starting build", { editions: cfg.editions });

  for (const edition of cfg.editions) {
    const overlayPath = path.join(cfg.overlayDir, edition === "2014" ? "srd-5e.yaml" : "srd-2024.yaml");
    const overlay = await loadOverlay(overlayPath);
    const classFeatureCount = Object.keys(overlay.class_features ?? {}).length;
    console.log(`[canonical] ${edition} overlay: loaded ${classFeatureCount} class-feature entries`);

    for (const kind of ALL_KINDS) {
      const open5e = await readOpen5eKind({
        kind,
        edition,
        apiBase: cfg.open5eApi,
        cacheDir: cfg.open5eCacheDir,
        refresh: cfg.refreshOpen5e,
      });
      const slugSet = deriveSlugSet(open5e);
      console.log(`[canonical] ${edition} ${kind}: ${open5e.length} entries`);

      const structuredKind = KIND_MAP[kind];
      const structured = structuredKind
        ? await readStructuredRules({ kind: structuredKind, edition, rootPath: cfg.structuredRulesPath, slugSet })
        : [];
      const activationKind = structuredKind ?? kind;
      const activation = await readActivationData({ kind: activationKind, edition, rootPath: cfg.structuredRulesPath, slugSet });

      const ruleEntry = RULES_BY_KIND[kind];
      if (!ruleEntry) {
        console.log(`[canonical]   no merge rule for ${kind} (skipped)`);
        continue;
      }

      const merged = mergeKind(ruleEntry.rule, { edition, kind, open5e, structured, activation, overlay });
      const canonical = merged.map(ruleEntry.toCanonical);
      console.log(`[canonical]   merged: ${canonical.length} canonical entries`);
    }

    // Optional-feature kind is overlay-driven (no Open5e endpoint exists).
    const optionalStructured = readOptionalFeaturesRaw(cfg.structuredRulesPath, edition);
    const optionalCanonical = mergeOptionalFeatures({ edition, structured: optionalStructured, overlay });
    console.log(`[canonical] ${edition} optional-features: ${optionalCanonical.length} canonical entries`);
  }

  console.log("[canonical] (md/runtime emitters populated by subsequent phases)");
}

main().catch(e => { console.error(e); process.exit(1); });
