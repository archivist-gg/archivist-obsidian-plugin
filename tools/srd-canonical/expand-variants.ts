import { slugifyName } from "./sources/slug-normalize";

/**
 * A base item eligible for variant expansion. The 5etools `magicvariants`
 * data targets bases by a mix of flag fields (`weapon`, `sword`, `axe`,
 * `armor`, `shield`, `arrow`, `bolt`), the short type code (`M`, `R`,
 * `HA`, `MA`, `LA`, `S`, `A`, `AF`), the `weaponCategory` (`simple` /
 * `martial`), and explicit `name`+`source` pairs. The optional fields
 * here mirror those columns from `items-base.json`.
 */
export interface BaseItem {
  name: string;
  slug: string;
  base_item_type: "weapon" | "armor" | "shield";
  /** 5etools short type code (e.g. "M", "R", "HA", "MA", "LA", "S", "A"). */
  type?: string;
  /** 5etools source code (e.g. "PHB", "XPHB"). */
  source?: string;
  weaponCategory?: string;
  weapon?: boolean;
  armor?: boolean;
  shield?: boolean;
  sword?: boolean;
  axe?: boolean;
  arrow?: boolean;
  bolt?: boolean;
  dmgType?: string;
  [key: string]: unknown;
}

export interface VariantRule {
  name: string;
  type?: string;
  requires?: Array<Record<string, unknown>>;
  inherits?: Record<string, unknown>;
}

export interface ExpandedItem {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  type: string;
  rarity?: string;
  tier?: "major" | "minor";
  base_item: string;
  bonuses?: { weapon_attack?: number; weapon_damage?: number; ac?: number };
  attunement: { required: boolean };
  description: string;
  weight?: number;
}

export function expandVariants(
  baseItems: BaseItem[],
  variants: VariantRule[],
  edition: "2014" | "2024",
): ExpandedItem[] {
  const out: ExpandedItem[] = [];
  for (const variant of variants) {
    const matchingBases = pickMatchingBases(baseItems, variant);
    for (const base of matchingBases) {
      out.push(applyVariantToBase(variant, base, edition));
    }
  }
  return out;
}

/**
 * Test whether a single `requires` clause matches a base item. A clause is
 * an object with one or more flag/value entries; ALL entries must match
 * (logical AND within a clause). The list of clauses is OR'd by the caller.
 */
function clauseMatches(req: Record<string, unknown>, b: BaseItem): boolean {
  for (const [k, v] of Object.entries(req)) {
    switch (k) {
      case "baseItem": {
        if (typeof v !== "string") return false;
        const reqSlug = v.split("|")[0];
        if (b.slug !== reqSlug) return false;
        break;
      }
      case "name": {
        if (typeof v !== "string" || b.name !== v) return false;
        break;
      }
      case "source": {
        if (typeof v !== "string" || (b.source !== undefined && b.source !== v)) return false;
        break;
      }
      case "type": {
        // 5etools type codes can carry a source suffix ("M|XPHB"); strip it.
        if (typeof v !== "string") return false;
        const reqType = v.split("|")[0];
        const baseType = (b.type ?? "").split("|")[0];
        if (baseType !== reqType) return false;
        break;
      }
      case "weaponCategory": {
        if (typeof v !== "string" || b.weaponCategory !== v) return false;
        break;
      }
      case "weapon":
        if (!truthy(v) || b.base_item_type !== "weapon") return false;
        break;
      case "armor":
        if (!truthy(v) || b.base_item_type !== "armor") return false;
        break;
      case "shield":
        if (!truthy(v) || b.base_item_type !== "shield") return false;
        break;
      case "sword":
      case "axe":
      case "arrow":
      case "bolt":
        if (!truthy(v) || b[k] !== true) return false;
        break;
      case "dmgType":
        if (typeof v !== "string" || b.dmgType !== v) return false;
        break;
      default:
        // Unknown key — treat as no-match to avoid over-expanding into
        // requirements we don't yet model (e.g. firearm, tattoo).
        return false;
    }
  }
  return true;
}

function truthy(v: unknown): boolean {
  return v === true || v === "true";
}

function pickMatchingBases(baseItems: BaseItem[], variant: VariantRule): BaseItem[] {
  if (!variant.requires || variant.requires.length === 0) return baseItems;
  // Each entry in `requires` is an OR'd alternative; a base matches if any clause matches.
  return baseItems.filter(b => variant.requires!.some(req => clauseMatches(req, b)));
}

function bonusNumber(field: unknown): number {
  if (typeof field === "number") return field;
  if (typeof field === "string") return Number(field.replace("+", "")) || 0;
  return 0;
}

function compendiumLabel(edition: "2014" | "2024"): string {
  return edition === "2014" ? "SRD 5e" : "SRD 2024";
}

function baseSubfolder(b: BaseItem): "Weapons" | "Armor" {
  // Shields use the Armor folder in our bundle.
  return b.base_item_type === "weapon" ? "Weapons" : "Armor";
}

/**
 * Build the expanded entry's `name`. Prefer the variant's explicit
 * `inherits.namePrefix` (e.g. "+1 ", "Frost Brand "); otherwise fall
 * back to a "+N" suffix derived from `bonusWeapon`/`bonusAc`.
 */
function expandedName(variant: VariantRule, base: BaseItem): string {
  const inherits = variant.inherits ?? {};
  const namePrefix = inherits.namePrefix;
  if (typeof namePrefix === "string" && namePrefix.length > 0) {
    // `namePrefix` strings already end with a trailing space ("+1 ", "Frost Brand ").
    if (namePrefix.startsWith("+")) {
      // "+N " patterns are written as suffix in our naming convention:
      // "Longsword +1" rather than "+1 Longsword".
      return `${base.name} ${namePrefix.trim()}`;
    }
    return `${namePrefix}${base.name}`;
  }
  const bWeapon = bonusNumber(inherits.bonusWeapon);
  const bAc = bonusNumber(inherits.bonusAc);
  const bonus = bWeapon || bAc;
  if (bonus > 0) return `${base.name} +${bonus}`;
  // No prefix/bonus signal — fall back to comma-suffix using variant name.
  return `${base.name}, ${variant.name}`;
}

function applyVariantToBase(variant: VariantRule, base: BaseItem, edition: "2014" | "2024"): ExpandedItem {
  const inherits = variant.inherits ?? {};
  const compendium = compendiumLabel(edition);
  const subfolder = baseSubfolder(base);
  const name = expandedName(variant, base);

  const bWeapon = bonusNumber(inherits.bonusWeapon);
  const bAc = bonusNumber(inherits.bonusAc);
  let bonuses: ExpandedItem["bonuses"] | undefined;
  if (bWeapon > 0) {
    bonuses = bonuses ?? {};
    bonuses.weapon_attack = bWeapon;
    bonuses.weapon_damage = bWeapon;
  }
  if (bAc > 0) {
    bonuses = bonuses ?? {};
    bonuses.ac = bAc;
  }

  const reqAttune = inherits.reqAttune === true || typeof inherits.reqAttune === "string";
  const rarity = typeof inherits.rarity === "string" ? inherits.rarity : undefined;
  const tier: "major" | "minor" | undefined = (() => {
    if (inherits.tier === "major" || inherits.tier === "minor") return inherits.tier;
    if (typeof inherits.tier === "number" && inherits.tier >= 1) return "major";
    if (typeof inherits.tier === "string") {
      const n = Number.parseInt(inherits.tier, 10);
      if (!Number.isNaN(n) && n >= 1) return "major";
    }
    return undefined;
  })();

  // Weight inherits from the base item (variant rules don't override weight).
  const weight = typeof base.weight === "number" ? base.weight : undefined;

  return {
    slug: slugifyName(name),
    name,
    edition,
    source: edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    type: base.base_item_type,
    rarity,
    tier,
    base_item: `[[${compendium}/${subfolder}/${base.name}]]`,
    ...(bonuses ? { bonuses } : {}),
    attunement: { required: reqAttune },
    description: buildDescription(variant, base, inherits),
    ...(weight !== undefined ? { weight } : {}),
  };
}

/**
 * Replace `{=fieldName}` template references in a string with the matching
 * `inherits[fieldName]` value. Optional `/format` suffixes (e.g. `{=name/u}`
 * for uppercase) are stripped — the raw value is substituted. References to
 * fields not present on `inherits` are left untouched so the surface bug is
 * still visible.
 */
function substituteTemplateVars(text: string, inherits: Record<string, unknown>): string {
  return text.replace(/\{=([^}/]+)(?:\/[^}]+)?\}/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    const value = inherits[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
    return match;
  });
}

function buildDescription(variant: VariantRule, base: BaseItem, inherits: Record<string, unknown>): string {
  const entries = inherits.entries;
  if (Array.isArray(entries)) {
    const text = (entries as unknown[]).filter((e): e is string => typeof e === "string").join("\n\n");
    if (text.length > 0) return substituteTemplateVars(text, inherits);
  }
  const bonusStr = (inherits.bonusWeapon ?? inherits.bonusAc ?? "") as string;
  if (bonusStr) {
    return `A magical version of the ${base.name.toLowerCase()} that grants its wielder a ${bonusStr} bonus.`;
  }
  return `A magical version of the ${base.name.toLowerCase()}: ${variant.name}.`;
}
