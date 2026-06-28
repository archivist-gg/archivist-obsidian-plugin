import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";

export interface ArmorCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  /** Typically "light" | "medium" | "heavy" | "shield" — kept as string for upstream resilience. */
  category: string;
  ac: { base: number; add_dex: boolean; dex_max?: number };
  strength_required?: number;
  stealth_disadvantage: boolean;
}

export const armorMergeRule: MergeRule = {
  kind: "armor",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Armor is well-structured upstream; no overlay merging needed.
    return null;
  },
};

export function toArmorCanonical(entry: CanonicalEntry): ArmorCanonical {
  const base = entry.base as Record<string, unknown>;

  const acBase = typeof base.ac_base === "number" ? base.ac_base : 0;
  const acAddDex = base.ac_add_dexmod === true;
  const acCapDex = typeof base.ac_cap_dexmod === "number" ? base.ac_cap_dexmod : undefined;

  const ac: ArmorCanonical["ac"] = {
    base: acBase,
    add_dex: acAddDex,
    ...(acCapDex !== undefined ? { dex_max: acCapDex } : {}),
  };

  const out: ArmorCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    category: (base.category as string | undefined) ?? "",
    ac,
    stealth_disadvantage: base.grants_stealth_disadvantage === true,
  };

  if (typeof base.strength_score_required === "number") {
    out.strength_required = base.strength_score_required;
  }

  return out;
}
