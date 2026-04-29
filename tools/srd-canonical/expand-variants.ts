import { slugifyName } from "./sources/slug-normalize";

export interface BaseItem {
  name: string;
  slug: string;
  base_item_type: "weapon" | "armor" | "shield";
  [key: string]: unknown;
}

export interface VariantRule {
  name: string;
  type?: string;
  requires?: Array<Record<string, string>>;
  inherits?: Record<string, unknown>;
}

export interface ExpandedItem {
  name: string;
  slug: string;
  edition: "2014" | "2024";
  base_item: string;
  bonuses: { attack?: number; damage?: number; ac?: number };
  rarity?: string;
  tier?: number;
  attunement: { required: boolean };
  description: string;
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

function pickMatchingBases(baseItems: BaseItem[], variant: VariantRule): BaseItem[] {
  if (!variant.requires || variant.requires.length === 0) return baseItems;
  return baseItems.filter(b => {
    for (const req of variant.requires!) {
      if (req.baseItem) {
        const reqSlug = req.baseItem.split("|")[0];
        if (b.slug !== reqSlug) return false;
      }
      if (req.weapon === "true" && b.base_item_type !== "weapon") return false;
      if (req.armor === "true" && b.base_item_type !== "armor") return false;
      if (req.shield === "true" && b.base_item_type !== "shield") return false;
    }
    return true;
  });
}

function applyVariantToBase(variant: VariantRule, base: BaseItem, edition: "2014" | "2024"): ExpandedItem {
  const inherits = variant.inherits ?? {};
  const bonusStr = (inherits.bonusWeapon ?? inherits.bonusAc ?? "+0") as string;
  const bonusNum = Number(bonusStr.replace("+", ""));
  const variantSuffix = bonusNum > 0
    ? ` +${bonusNum}`
    : `, ${variant.name.replace(/[+0-9]/g, "").trim()}`;
  const expandedName = `${base.name}${variantSuffix}`;
  const compendium = edition === "2014" ? "SRD 5e" : "SRD 2024";
  return {
    name: expandedName,
    slug: slugifyName(expandedName),
    edition,
    base_item: `[[${compendium}/${base.name}]]`,
    bonuses: {
      attack: inherits.bonusWeapon ? bonusNum : undefined,
      damage: inherits.bonusWeapon ? bonusNum : undefined,
      ac: inherits.bonusAc ? bonusNum : undefined,
    },
    rarity: inherits.rarity as string | undefined,
    tier: inherits.tier ? Number(inherits.tier) : undefined,
    attunement: { required: false },
    description: `A magical version of the ${base.name.toLowerCase()} that grants its wielder a ${bonusStr} bonus.`,
  };
}
