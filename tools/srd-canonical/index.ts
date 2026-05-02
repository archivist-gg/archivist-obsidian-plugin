#!/usr/bin/env tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config";
import { readOpen5eKind, deriveSlugSet, type Open5eKind } from "./sources/open-srd";
import { readStructuredRules, type StructuredRulesKind, type StructuredEntry } from "./sources/structured-rules";
import { readActivationData } from "./sources/activation";
import { loadOverlay } from "./sources/overlay";
import { mergeKind, type MergeRule, type CanonicalEntry } from "./merger";
import { projectToRuntime } from "./to-runtime";
import { writeMd, writeCompendiumIndex } from "./to-md";

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
import { conditionMergeRule, toConditionCanonical, buildConditionsFromStructured } from "./merger-rules/condition-merge";
import { mergeOptionalFeatures } from "./merger-rules/optional-feature-merge";
import { expandVariants, type BaseItem, type VariantRule } from "./expand-variants";
import { slugifyName } from "./sources/slug-normalize";

/**
 * Map an Open5e kind name to the runtime/MD kind name. Open5e uses plural
 * collection names; the runtime projector and MD writer use singular entity
 * names. Subclasses are routed off "classes" via subclass_of, so they don't
 * appear in the main loop here.
 */
const OPEN5E_KIND_TO_ENTITY: Record<Open5eKind, string> = {
  classes: "class",
  species: "race",
  feats: "feat",
  backgrounds: "background",
  spells: "spell",
  magicitems: "item",
  weapons: "weapon",
  armor: "armor",
  creatures: "monster",
  conditions: "condition",
};

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
  conditions: "conditions",
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
// Entries with `subclass_of !== null` are split off the classes pass and
// run through subclassMergeRule + toSubclassCanonical.

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

/**
 * Read SRD-flagged base items (weapons / armor / shields) directly from
 * `items-base.json`. Variants in `magicvariants.json` target bases via
 * a mix of flag fields, type codes, and explicit name+source pairs;
 * this loader passes through the rich shape so {@link expandVariants}
 * can reconcile.
 */
function readBaseItemsRaw(rootPath: string, edition: "2014" | "2024"): BaseItem[] {
  const filePath = path.join(rootPath, "items-base.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { baseitem?: Array<Record<string, unknown>> };
  const all = raw.baseitem ?? [];
  const flagKey = edition === "2014" ? "srd" : "srd52";
  const out: BaseItem[] = [];
  for (const e of all) {
    if (e[flagKey] !== true) continue;
    const name = e.name as string;
    const source = e.source as string | undefined;
    let kind: "weapon" | "armor" | "shield" | null = null;
    if (e.weapon === true) kind = "weapon";
    else if (e.armor === true) kind = "armor";
    else if ((typeof e.type === "string") && (e.type === "S" || e.type.startsWith("S|"))) kind = "shield";
    if (!kind) continue;
    out.push({
      name,
      slug: slugifyName(name),
      base_item_type: kind,
      type: typeof e.type === "string" ? e.type : undefined,
      source,
      weaponCategory: typeof e.weaponCategory === "string" ? e.weaponCategory : undefined,
      weapon: e.weapon === true,
      armor: e.armor === true,
      shield: kind === "shield",
      sword: e.sword === true,
      axe: e.axe === true,
      arrow: e.arrow === true,
      bolt: e.bolt === true,
      dmgType: typeof e.dmgType === "string" ? e.dmgType : undefined,
    });
  }
  return out;
}

/**
 * Read SRD-flagged variant rules from `magicvariants.json`. The standard
 * structured-rules reader filters by `e.source`, but variant entries
 * carry their source under `inherits.source`. Gate on the per-entry SRD
 * flag stored under `inherits.srd` (2014) or `inherits.srd52` (2024).
 */
function readMagicVariantsRaw(rootPath: string, edition: "2014" | "2024"): VariantRule[] {
  const filePath = path.join(rootPath, "magicvariants.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { magicvariant?: Array<Record<string, unknown>> };
  const all = raw.magicvariant ?? [];
  const flagKey = edition === "2014" ? "srd" : "srd52";
  const out: VariantRule[] = [];
  for (const e of all) {
    const inherits = e.inherits as Record<string, unknown> | undefined;
    if (!inherits || inherits[flagKey] !== true) continue;
    out.push({
      name: e.name as string,
      type: typeof e.type === "string" ? e.type : undefined,
      requires: Array.isArray(e.requires) ? (e.requires as Array<Record<string, unknown>>) : undefined,
      inherits,
    });
  }
  return out;
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

      // Conditions: Open5e exposes 0 entries for SRD documents, so the
      // standard mergeKind path (which iterates over open5e) emits nothing.
      // Build CanonicalEntries directly from the structured-rules dump and
      // run them through toConditionCanonical. The Open5e-fed mergeKind path
      // remains the primary read for every other kind.
      if (kind === "conditions") {
        const merged = buildConditionsFromStructured(structured, edition);
        const canonical = merged.map(toConditionCanonical);
        console.log(`[canonical]   merged: ${canonical.length} canonical entries`);

        emitForKind({
          canonical: canonical as unknown as Array<Record<string, unknown> & { name: string; slug: string }>,
          entityKind: OPEN5E_KIND_TO_ENTITY[kind],
          kind,
          edition,
          canonicalOutDir: cfg.canonicalOutDir,
          runtimeOutDir: cfg.runtimeOutDir,
          bundleOutDir: cfg.bundleOutDir,
        });
        continue;
      }

      // Classes endpoint also serves subclass entries (subclass_of !== null).
      // Split the two so each goes through its own merge rule.
      let classOpen5e = open5e;
      let subclassOpen5e: typeof open5e = [];
      if (kind === "classes") {
        classOpen5e = open5e.filter(e => !(e as { subclass_of?: unknown }).subclass_of);
        subclassOpen5e = open5e.filter(e => Boolean((e as { subclass_of?: unknown }).subclass_of));
        console.log(`[canonical]   split: ${classOpen5e.length} classes, ${subclassOpen5e.length} subclasses`);
      }

      const merged = mergeKind(ruleEntry.rule, { edition, kind, open5e: classOpen5e, structured, activation, overlay });
      const canonical = merged.map(ruleEntry.toCanonical);
      console.log(`[canonical]   merged: ${canonical.length} canonical entries`);

      const entityKind = OPEN5E_KIND_TO_ENTITY[kind];
      emitForKind({
        canonical: canonical as Array<Record<string, unknown> & { name: string; slug: string }>,
        entityKind,
        kind,
        edition,
        canonicalOutDir: cfg.canonicalOutDir,
        runtimeOutDir: cfg.runtimeOutDir,
        bundleOutDir: cfg.bundleOutDir,
      });

      if (kind === "classes" && subclassOpen5e.length > 0) {
        const subMerged = mergeKind(subclassMergeRule, { edition, kind: "subclass", open5e: subclassOpen5e, structured: [], activation: new Map(), overlay });
        const subCanonical = subMerged.map(toSubclassCanonical);
        console.log(`[canonical]   subclass merged: ${subCanonical.length} canonical entries`);
        emitForKind({
          canonical: subCanonical as unknown as Array<Record<string, unknown> & { name: string; slug: string }>,
          entityKind: "subclass",
          kind: "subclasses",
          edition,
          canonicalOutDir: cfg.canonicalOutDir,
          runtimeOutDir: cfg.runtimeOutDir,
          bundleOutDir: cfg.bundleOutDir,
        });
      }
    }

    // Optional-feature kind is overlay-driven (no Open5e endpoint exists).
    const optionalStructured = readOptionalFeaturesRaw(cfg.structuredRulesPath, edition);
    const optionalCanonical = mergeOptionalFeatures({ edition, structured: optionalStructured, overlay });
    console.log(`[canonical] ${edition} optional-features: ${optionalCanonical.length} canonical entries`);

    emitForKind({
      canonical: optionalCanonical as unknown as Array<Record<string, unknown> & { name: string; slug: string }>,
      entityKind: "optional-feature",
      kind: "optional-features",
      edition,
      canonicalOutDir: cfg.canonicalOutDir,
      runtimeOutDir: cfg.runtimeOutDir,
      bundleOutDir: cfg.bundleOutDir,
    });

    // Magic-variant expansion: cross every SRD-flagged variant rule with
    // every eligible SRD base item to emit the full grid of "+1 Weapon",
    // "Frost Brand Longsword", etc. Variants are 5etools-only metadata
    // (Open5e exposes a few rolled-out variants but no rule-level dump),
    // so this step runs from raw structured-rules without an Open5e join.
    // The runtime file `item.{edition}.json` is shared with the magicitems
    // pass — the expanded entries are appended onto it rather than via
    // {@link emitForKind} (which would overwrite the file).
    const baseItems = readBaseItemsRaw(cfg.structuredRulesPath, edition);
    const variantRules = readMagicVariantsRaw(cfg.structuredRulesPath, edition);
    const expanded = expandVariants(baseItems, variantRules, edition);
    console.log(`[canonical] ${edition} magic-variants: ${variantRules.length} rules × ${baseItems.length} bases → ${expanded.length} expanded items`);
    if (expanded.length > 0) {
      const compendium = edition === "2014" ? "SRD 5e" : "SRD 2024";

      // 1. Full canonical JSON — separate file from magicitems for traceability.
      fs.mkdirSync(cfg.canonicalOutDir, { recursive: true });
      const variantCanonicalFile = path.join(cfg.canonicalOutDir, `magicitems-variants.${edition}.json`);
      fs.writeFileSync(variantCanonicalFile, JSON.stringify(expanded, null, 2));

      // 2. Runtime — append to the existing item.{edition}.json instead of overwriting.
      fs.mkdirSync(cfg.runtimeOutDir, { recursive: true });
      const itemRuntimeFile = path.join(cfg.runtimeOutDir, `item.${edition}.json`);
      const existingRuntime = fs.existsSync(itemRuntimeFile)
        ? (JSON.parse(fs.readFileSync(itemRuntimeFile, "utf8")) as unknown[])
        : [];
      const variantRuntime = expanded.map(e => projectToRuntime("item", e as unknown as Record<string, unknown>));
      fs.writeFileSync(itemRuntimeFile, JSON.stringify([...existingRuntime, ...variantRuntime], null, 2));

      // 3. Vault MD per entry — kind=item routes to Magic Items folder.
      const variantBundleDir = path.join(cfg.bundleOutDir, compendium);
      for (const entry of expanded) {
        writeMd(variantBundleDir, {
          kind: "item",
          edition,
          compendium,
          data: entry as unknown as Record<string, unknown> & { name: string; slug: string },
        });
      }
      console.log(`[canonical]   variant emit: canonical(${variantCanonicalFile}) runtime(append +${variantRuntime.length}) md(${expanded.length} files)`);
    }

    // Compendium index per edition (single _compendium.md at the bundle root).
    const compendium = edition === "2014" ? "SRD 5e" : "SRD 2024";
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "..", "manifest.json"), "utf8")) as { version: string };
    writeCompendiumIndex(path.join(cfg.bundleOutDir, compendium), compendium, edition, manifest.version);
    console.log(`[canonical] ${edition} wrote _compendium.md`);
  }

  // Aggregate the entire bundle directory into a single path → content map and
  // write it to .compendium-bundle/index.json. The plugin's compendium-init
  // module imports this JSON at build time and copies it into the user's vault
  // on first install / version upgrade.
  const bundleIndex: Record<string, string> = {};
  function walkAndIndex(dir: string, prefix = ""): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const sub = path.join(dir, entry.name);
      const rel = prefix + entry.name;
      if (entry.isDirectory()) walkAndIndex(sub, rel + "/");
      else if (entry.name.endsWith(".md")) bundleIndex[rel] = fs.readFileSync(sub, "utf8");
    }
  }
  walkAndIndex(cfg.bundleOutDir);
  fs.writeFileSync(path.join(cfg.bundleOutDir, "index.json"), JSON.stringify(bundleIndex));
  console.log(`[canonical] wrote bundle index: ${Object.keys(bundleIndex).length} files`);

  console.log("[canonical] done");
}

/**
 * Emit per-kind outputs:
 *  1. Full canonical JSON (committed for reproducibility).
 *  2. Slim runtime JSON (committed, embedded in plugin).
 *  3. One MD file per entry under .compendium-bundle/{compendium}/{folder}/.
 */
function emitForKind(opts: {
  canonical: Array<Record<string, unknown> & { name: string; slug: string }>;
  entityKind: string;
  kind: string;
  edition: "2014" | "2024";
  canonicalOutDir: string;
  runtimeOutDir: string;
  bundleOutDir: string;
}): void {
  const { canonical, entityKind, kind, edition, canonicalOutDir, runtimeOutDir, bundleOutDir } = opts;
  const compendium = edition === "2014" ? "SRD 5e" : "SRD 2024";

  // 1. Full canonical JSON.
  fs.mkdirSync(canonicalOutDir, { recursive: true });
  const canonicalFile = path.join(canonicalOutDir, `${kind}.${edition}.json`);
  fs.writeFileSync(canonicalFile, JSON.stringify(canonical, null, 2));

  // 2. Slim runtime JSON.
  fs.mkdirSync(runtimeOutDir, { recursive: true });
  const runtimeEntries = canonical.map(c => projectToRuntime(entityKind, c));
  const runtimeFile = path.join(runtimeOutDir, `${entityKind}.${edition}.json`);
  fs.writeFileSync(runtimeFile, JSON.stringify(runtimeEntries, null, 2));

  // 3. Vault MD per entry.
  const bundleDir = path.join(bundleOutDir, compendium);
  for (const entry of canonical) {
    writeMd(bundleDir, {
      kind: entityKind,
      edition,
      compendium,
      data: entry,
    });
  }
  console.log(`[canonical]   emit: canonical(${canonicalFile}) runtime(${runtimeFile}) md(${canonical.length} files)`);
}

main().catch(e => { console.error(e); process.exit(1); });
