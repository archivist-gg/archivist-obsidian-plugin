import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";

export interface WeaponCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  category: string;
  damage: { dice: string; type: string; versatile_dice?: string };
  properties: string[];
  range?: { normal: number; long: number };
  /** Mastery property names (kebab-case), surfaced from
   *  Open5e `properties[].property.type === "Mastery"`.
   */
  mastery?: string[];
}

export const weaponMergeRule: MergeRule = {
  kind: "weapon",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Weapons are well-structured upstream; no overlay merging needed.
    return null;
  },
};

interface Open5eProperty {
  property: { name: string; type: string | null; desc?: string };
  detail: string | null;
}

interface Open5eWeapon {
  name: string;
  damage_dice?: string;
  damage_type?: { name?: string; key?: string };
  range?: number;
  long_range?: number;
  is_simple?: boolean;
  is_improvised?: boolean;
  properties?: Open5eProperty[];
}

function kebab(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function computeCategory(base: Open5eWeapon): string {
  if (base.is_improvised === true) return "improvised";
  const range = typeof base.range === "number" ? base.range : 0;
  const isRanged = range > 0;
  if (base.is_simple === true) return isRanged ? "simple-ranged" : "simple-melee";
  return isRanged ? "martial-ranged" : "martial-melee";
}

export function toWeaponCanonical(entry: CanonicalEntry): WeaponCanonical {
  const base = entry.base as unknown as Open5eWeapon;
  const properties = Array.isArray(base.properties) ? base.properties : [];

  // Damage composition
  const versatileEntry = properties.find(p => p.property?.name === "Versatile");
  const damage: WeaponCanonical["damage"] = {
    dice: base.damage_dice ?? "",
    type: base.damage_type?.key ?? "",
  };
  if (versatileEntry?.detail) damage.versatile_dice = versatileEntry.detail;

  // Properties: non-Mastery → string[] (kebab-case names).
  // Mastery: separate field.
  const propNames: string[] = [];
  const masteryNames: string[] = [];
  for (const p of properties) {
    const name = p.property?.name;
    if (!name) continue;
    if (p.property.type === "Mastery") {
      masteryNames.push(kebab(name));
    } else {
      propNames.push(kebab(name));
    }
  }

  const out: WeaponCanonical = {
    slug: entry.slug,
    name: base.name,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    category: computeCategory(base),
    damage,
    properties: propNames,
  };

  if (typeof base.range === "number" && base.range > 0) {
    out.range = {
      normal: base.range,
      long: typeof base.long_range === "number" ? base.long_range : 0,
    };
  }

  if (masteryNames.length > 0) out.mastery = masteryNames;

  return out;
}
