import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";

export interface ArmorCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  /** Typically "light" | "medium" | "heavy" | "shield" — kept as string for upstream resilience. */
  category: string;
  ac: { base: number; dex_max?: number };
  strength_required?: number;
  stealth_disadvantage: boolean;
  weight?: number | string;
  cost?: string;
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

  const acRaw = base.ac;
  let ac: ArmorCanonical["ac"];
  if (acRaw && typeof acRaw === "object") {
    const obj = acRaw as { base?: number; dex_max?: number };
    ac = { base: typeof obj.base === "number" ? obj.base : 0 };
    if (typeof obj.dex_max === "number") ac.dex_max = obj.dex_max;
  } else {
    // Fallback to flat fields if Open5e returns unstructured shape.
    const flatBase = (base.ac_base as number | undefined) ?? 0;
    ac = { base: flatBase };
    const flatDex = base.ac_add_dexmod as number | undefined;
    if (typeof flatDex === "number") ac.dex_max = flatDex;
  }

  const out: ArmorCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    category: (base.category as string | undefined) ?? "",
    ac,
    stealth_disadvantage: base.stealth_disadvantage === true,
  };

  if (typeof base.strength_required === "number") out.strength_required = base.strength_required;
  if (typeof base.weight === "number" || typeof base.weight === "string") {
    out.weight = base.weight;
  }
  if (typeof base.cost === "string") out.cost = base.cost;

  return out;
}
