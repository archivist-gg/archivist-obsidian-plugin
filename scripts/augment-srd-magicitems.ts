// scripts/augment-srd-magicitems.ts
//
// One-time augmentation script: enriches the bundled magic-items list
// (`src/srd/data/magicitems.json`) with structured mechanical fields
// (bonuses, resist/immune, attached_spells, attunement tags, charges, etc.)
// looked up from a local external reference dataset.
//
// The reference data lives at REFERENCE_DATA_DIR. We never name the
// upstream source by brand — see the project rule.
//
// Usage:
//   npx tsx scripts/augment-srd-magicitems.ts
//
// The script overwrites `src/srd/data/magicitems.json` in place with the
// augmented JSON, preserving every existing field (including the original
// `desc`, which downstream `normalizeSrdItem` still uses for `entries`).

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..");
const OPEN_DATA_PATH = path.join(REPO_ROOT, "src/srd/data/magicitems.json");
const REFERENCE_DATA_DIR = "/Users/shinoobi/w/archivist-pc";
const REFERENCE_ITEMS_PATH = path.join(REFERENCE_DATA_DIR, "items.json");
const REFERENCE_BASE_ITEMS_PATH = path.join(REFERENCE_DATA_DIR, "items-base.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenItemRecord {
  name: string;
  desc?: string;
  rarity?: string;
  type?: string;
  requires_attunement?: string | boolean;
  // Augmented fields (added by this script):
  bonuses?: Record<string, unknown>;
  resist?: string[];
  immune?: string[];
  vulnerable?: string[];
  condition_immune?: string[];
  attached_spells?: Record<string, unknown>;
  attunement?: unknown;
  grants?: Record<string, unknown>;
  charges?: number | Record<string, unknown>;
  tier?: string;
  base_item?: string;
  [k: string]: unknown;
}

export interface ReferenceItemEntry {
  name: string;
  source?: string;
  srd?: boolean;
  srd52?: boolean;
  basicRules?: boolean;
  _copy?: { name: string; source?: string; _mod?: unknown; _preserve?: unknown };
  bonusAc?: string;
  bonusWeapon?: string;
  bonusWeaponAttack?: string;
  bonusWeaponDamage?: string;
  bonusSpellAttack?: string;
  bonusSpellSaveDc?: string;
  bonusSavingThrow?: string;
  ability?: Record<string, unknown>;
  resist?: string[];
  immune?: string[];
  vulnerable?: string[];
  conditionImmune?: string[];
  charges?: number;
  recharge?: string;
  rechargeAmount?: string;
  attachedSpells?: Record<string, unknown>;
  reqAttune?: boolean | string;
  reqAttuneTags?: unknown[];
  grantsLanguage?: boolean;
  grantsProficiency?: boolean;
  tier?: string;
  baseItem?: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Slugify per the convention at entity-vault-store.ts:38-45.
 * "Bracers of Defense" -> "bracers-of-defense"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a signed integer string like "+2" or "-1" into a number.
 * Returns undefined if the input doesn't match the expected shape.
 */
export function parseSignedInt(input: unknown): number | undefined {
  if (typeof input === "number" && Number.isInteger(input)) return input;
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  // Accept "+2", "-1", "2"
  const m = trimmed.match(/^([+-]?\d+)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Strip template-tag wrappers like `{@dice 1d6 + 1}` to bare `1d6 + 1`.
 * Leaves plain dice strings untouched.
 */
export function unwrapDice(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  const m = trimmed.match(/^\{@dice\s+([^}]+)\}$/);
  if (m) return m[1].trim();
  return trimmed;
}

/**
 * Strip pipe-coded source from a templated tag like "Dagger|PHB" -> "Dagger".
 */
export function stripPipeSource(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (trimmed === "") return undefined;
  return trimmed.split("|")[0].trim();
}

/**
 * Build a slug -> reference-entry index. When multiple entries share a slug,
 * prefer those flagged `srd: true` (or `srd52: true`), then concrete entries
 * over `_copy`-only entries.
 */
export function buildSlugIndex(
  entries: ReferenceItemEntry[],
): Map<string, ReferenceItemEntry> {
  const index = new Map<string, ReferenceItemEntry>();
  const isSrd = (e: ReferenceItemEntry): boolean => e.srd === true || e.srd52 === true;

  for (const e of entries) {
    if (!e || typeof e.name !== "string") continue;
    const slug = slugify(e.name);
    if (slug === "") continue;
    const existing = index.get(slug);
    if (!existing) {
      index.set(slug, e);
      continue;
    }
    const existingIsSrd = isSrd(existing);
    const newIsSrd = isSrd(e);
    if (newIsSrd && !existingIsSrd) {
      index.set(slug, e);
      continue;
    }
    if (!newIsSrd && existingIsSrd) continue;
    // Same SRD-ness — prefer concrete (no _copy) over a _copy stub.
    if (!e._copy && existing._copy) {
      index.set(slug, e);
      continue;
    }
  }
  return index;
}

/**
 * Resolve a reference entry's `_copy` chain into a single flat record.
 * Recursive but bounded; returns the entry unchanged if no `_copy` (or if
 * the parent can't be located, or depth exceeds 5).
 */
export function resolveCopy(
  entry: ReferenceItemEntry,
  index: Map<string, ReferenceItemEntry>,
  depth = 0,
): ReferenceItemEntry {
  if (!entry._copy || depth > 5) {
    const { _copy: _drop, ...rest } = entry;
    void _drop;
    return rest as ReferenceItemEntry;
  }
  const parentSlug = slugify(entry._copy.name);
  const parent = index.get(parentSlug);
  if (!parent) {
    const { _copy: _drop, ...rest } = entry;
    void _drop;
    return rest as ReferenceItemEntry;
  }
  const resolvedParent = resolveCopy(parent, index, depth + 1);
  // Own fields override parent fields. We intentionally drop the `_copy`
  // metadata key from the result; `_mod`/`_preserve` are out of scope.
  const { _copy: _drop, ...own } = entry;
  void _drop;
  return { ...resolvedParent, ...own } as ReferenceItemEntry;
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

/**
 * Convert a single reference entry to the structured-field overlay we want
 * merged into the corresponding open item record.
 *
 * Returns an object with only the fields that could be derived. Empty fields
 * are omitted so the caller can spread it without trampling existing keys.
 */
export function mapReferenceFields(
  ref: ReferenceItemEntry,
  warnings: string[] = [],
): Partial<OpenItemRecord> {
  const out: Partial<OpenItemRecord> = {};

  // -- bonuses ---------------------------------------------------------------
  const bonuses: Record<string, unknown> = {};

  if (ref.bonusAc !== undefined) {
    const n = parseSignedInt(ref.bonusAc);
    if (n !== undefined) bonuses.ac = n;
    else warnings.push(`bonusAc not parseable on ${ref.name}: ${String(ref.bonusAc)}`);
  }

  // bonusWeapon (when present, and no separate attack/damage given)
  // applies to BOTH attack and damage.
  const bw = ref.bonusWeapon !== undefined ? parseSignedInt(ref.bonusWeapon) : undefined;
  if (ref.bonusWeapon !== undefined && bw === undefined) {
    warnings.push(`bonusWeapon not parseable on ${ref.name}: ${String(ref.bonusWeapon)}`);
  }
  if (bw !== undefined) {
    bonuses.weapon_attack = bw;
    bonuses.weapon_damage = bw;
  }
  if (ref.bonusWeaponAttack !== undefined) {
    const n = parseSignedInt(ref.bonusWeaponAttack);
    if (n !== undefined) bonuses.weapon_attack = n;
    else warnings.push(`bonusWeaponAttack not parseable on ${ref.name}: ${String(ref.bonusWeaponAttack)}`);
  }
  if (ref.bonusWeaponDamage !== undefined) {
    const n = parseSignedInt(ref.bonusWeaponDamage);
    if (n !== undefined) bonuses.weapon_damage = n;
    else warnings.push(`bonusWeaponDamage not parseable on ${ref.name}: ${String(ref.bonusWeaponDamage)}`);
  }
  if (ref.bonusSpellAttack !== undefined) {
    const n = parseSignedInt(ref.bonusSpellAttack);
    if (n !== undefined) bonuses.spell_attack = n;
  }
  if (ref.bonusSpellSaveDc !== undefined) {
    const n = parseSignedInt(ref.bonusSpellSaveDc);
    if (n !== undefined) bonuses.spell_save_dc = n;
  }
  if (ref.bonusSavingThrow !== undefined) {
    const n = parseSignedInt(ref.bonusSavingThrow);
    if (n !== undefined) bonuses.saving_throws = n;
  }

  // -- ability ---------------------------------------------------------------
  // Reference shape: { ability: { static: {str: 21}, con: 2 } }
  // Map: static keys -> bonuses.ability_scores.static
  //      remaining top-level int keys -> bonuses.ability_scores.bonus
  if (ref.ability && typeof ref.ability === "object") {
    const ability = ref.ability as Record<string, unknown>;
    const ALLOWED = new Set(["str", "dex", "con", "int", "wis", "cha"]);
    const abilityScores: Record<string, Record<string, number>> = {};
    if (ability.static && typeof ability.static === "object") {
      const stat: Record<string, number> = {};
      for (const [k, v] of Object.entries(ability.static as Record<string, unknown>)) {
        if (ALLOWED.has(k) && typeof v === "number" && Number.isInteger(v)) stat[k] = v;
      }
      if (Object.keys(stat).length > 0) abilityScores.static = stat;
    }
    const bonus: Record<string, number> = {};
    for (const [k, v] of Object.entries(ability)) {
      if (k === "static") continue;
      if (!ALLOWED.has(k)) continue;
      if (typeof v === "number" && Number.isInteger(v)) bonus[k] = v;
    }
    if (Object.keys(bonus).length > 0) abilityScores.bonus = bonus;
    if (Object.keys(abilityScores).length > 0) {
      bonuses.ability_scores = abilityScores;
    }
  }

  if (Object.keys(bonuses).length > 0) out.bonuses = bonuses;

  // -- resist/immune/vulnerable/condition_immune ----------------------------
  if (Array.isArray(ref.resist) && ref.resist.length > 0) {
    out.resist = ref.resist.filter((s): s is string => typeof s === "string");
  }
  if (Array.isArray(ref.immune) && ref.immune.length > 0) {
    out.immune = ref.immune.filter((s): s is string => typeof s === "string");
  }
  if (Array.isArray(ref.vulnerable) && ref.vulnerable.length > 0) {
    out.vulnerable = ref.vulnerable.filter((s): s is string => typeof s === "string");
  }
  if (Array.isArray(ref.conditionImmune) && ref.conditionImmune.length > 0) {
    out.condition_immune = ref.conditionImmune.filter((s): s is string => typeof s === "string");
  }

  // -- charges --------------------------------------------------------------
  if (typeof ref.charges === "number" && Number.isInteger(ref.charges) && ref.charges > 0) {
    if (ref.recharge || ref.rechargeAmount) {
      const c: Record<string, unknown> = { max: ref.charges };
      if (typeof ref.recharge === "string" && ref.recharge.length > 0) c.recharge = ref.recharge;
      const rechargeAmt = unwrapDice(ref.rechargeAmount);
      if (rechargeAmt) c.recharge_amount = rechargeAmt;
      out.charges = c;
    } else {
      out.charges = ref.charges;
    }
  }

  // -- attached_spells ------------------------------------------------------
  if (ref.attachedSpells && typeof ref.attachedSpells === "object") {
    const src = ref.attachedSpells as Record<string, unknown>;
    const attached: Record<string, unknown> = {};
    if (src.daily) attached.daily = src.daily;
    if (src.charges) attached.charges = src.charges;
    if (src.will) attached.will = src.will;
    if (src.rest) attached.rest = src.rest;
    if (Object.keys(attached).length > 0) out.attached_spells = attached;
  }

  // -- attunement (canonical object form) -----------------------------------
  // Only emit when reqAttune or reqAttuneTags is present. The legacy
  // string/boolean form is left for normalizeSrdItem to handle off the
  // `requires_attunement` key.
  if (ref.reqAttune !== undefined || (Array.isArray(ref.reqAttuneTags) && ref.reqAttuneTags.length > 0)) {
    const attune: Record<string, unknown> = { required: false };
    if (ref.reqAttune === true) attune.required = true;
    else if (typeof ref.reqAttune === "string" && ref.reqAttune.length > 0) {
      attune.required = true;
      attune.restriction = ref.reqAttune;
    }
    if (Array.isArray(ref.reqAttuneTags) && ref.reqAttuneTags.length > 0) {
      // Tags arrive shaped like `{class: "wizard|tce"}`. Strip pipe-coded source.
      const tags = ref.reqAttuneTags
        .map((t) => {
          if (!t || typeof t !== "object") return undefined;
          const obj = t as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === "string") out[k] = stripPipeSource(v) ?? v;
            else out[k] = v;
          }
          return out;
        })
        .filter((t) => t !== undefined);
      if (tags.length > 0) attune.tags = tags;
    }
    if (attune.required === true || attune.tags) {
      out.attunement = attune;
    }
  }

  // -- grants ---------------------------------------------------------------
  const grants: Record<string, unknown> = {};
  if (ref.grantsLanguage === true) grants.languages = true;
  if (ref.grantsProficiency === true) grants.proficiency = true;
  if (Object.keys(grants).length > 0) out.grants = grants;

  // -- tier -----------------------------------------------------------------
  if (ref.tier === "major" || ref.tier === "minor") {
    out.tier = ref.tier;
  }

  // -- base_item ------------------------------------------------------------
  if (typeof ref.baseItem === "string" && ref.baseItem.length > 0) {
    const stripped = stripPipeSource(ref.baseItem);
    if (stripped) out.base_item = stripped;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Augmenter
// ---------------------------------------------------------------------------

export interface AugmentResult {
  items: OpenItemRecord[];
  augmentedCount: number;
  warnings: string[];
}

/**
 * Augment a list of open item records by looking them up in the merged
 * reference index (concrete + base) and overlaying mechanical fields.
 *
 * Existing keys on the open record are preserved (including `desc`).
 * Reference-derived fields are added only when not already present.
 */
export function augmentItems(
  openItems: OpenItemRecord[],
  referenceConcrete: ReferenceItemEntry[],
  referenceBase: ReferenceItemEntry[],
): AugmentResult {
  const warnings: string[] = [];
  // Order matters for de-duplication: concrete first, then base. The index
  // already prefers SRD-flagged entries among collisions.
  const index = buildSlugIndex([...referenceConcrete, ...referenceBase]);

  let augmentedCount = 0;
  const items = openItems.map((item) => {
    const slug = slugify(item.name);
    const ref = index.get(slug);
    if (!ref) return item;
    const resolved = resolveCopy(ref, index);
    const overlay = mapReferenceFields(resolved, warnings);
    if (Object.keys(overlay).length === 0) return item;
    augmentedCount++;
    // Preserve every existing field on `item`; only fill in missing keys.
    const merged: OpenItemRecord = { ...item };
    for (const [k, v] of Object.entries(overlay)) {
      if (!(k in merged) || merged[k] === undefined || merged[k] === null || merged[k] === "") {
        merged[k] = v;
      }
    }
    return merged;
  });

  return { items, augmentedCount, warnings };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function main(): void {
  if (!fs.existsSync(OPEN_DATA_PATH)) {
    console.error(`Bundled data not found: ${OPEN_DATA_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(REFERENCE_ITEMS_PATH) || !fs.existsSync(REFERENCE_BASE_ITEMS_PATH)) {
    console.error(`Reference data not found in ${REFERENCE_DATA_DIR}`);
    process.exit(1);
  }

  const openItems = JSON.parse(fs.readFileSync(OPEN_DATA_PATH, "utf-8")) as OpenItemRecord[];
  const refConcrete = (JSON.parse(fs.readFileSync(REFERENCE_ITEMS_PATH, "utf-8")) as { item: ReferenceItemEntry[] }).item;
  const refBase = (JSON.parse(fs.readFileSync(REFERENCE_BASE_ITEMS_PATH, "utf-8")) as { baseitem: ReferenceItemEntry[] }).baseitem;

  console.log(`Processing ${openItems.length} bundled items against ${refConcrete.length} concrete + ${refBase.length} base reference entries...`);

  const { items, augmentedCount, warnings } = augmentItems(openItems, refConcrete, refBase);

  fs.writeFileSync(OPEN_DATA_PATH, JSON.stringify(items, null, 2) + "\n", "utf-8");

  console.log(`Augmented ${augmentedCount} of ${items.length} items.`);
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  // Sample a few well-known items
  for (const sampleName of ["Bracers of Defense", "Cloak of Protection", "Ring of Protection", "Belt of Hill Giant Strength", "Robe of the Archmagi"]) {
    const found = items.find((i) => i.name === sampleName);
    if (found) {
      const fields = ["bonuses", "resist", "attached_spells", "attunement", "tier", "charges"]
        .filter((k) => k in found && found[k] !== undefined);
      console.log(`  ${sampleName}: ${fields.join(", ") || "(no structured fields)"}`);
    }
  }
}

// Only run when invoked directly (not when imported by tests).
const isMain = require.main === module;
if (isMain) main();
