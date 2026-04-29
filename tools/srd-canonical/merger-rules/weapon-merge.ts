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
  cost?: string;
  weight?: number | string;
  /** 2024-only — mastery property from structured-rules. */
  mastery?: string[];
}

export const weaponMergeRule: MergeRule = {
  kind: "weapon",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Weapons are well-structured upstream; no overlay merging needed.
    return null;
  },
};

export function toWeaponCanonical(entry: CanonicalEntry): WeaponCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;

  const damageRaw = (base.damage ?? {}) as { dice?: string; type?: string; versatile_dice?: string };
  const damage: WeaponCanonical["damage"] = {
    dice: damageRaw.dice ?? "",
    type: damageRaw.type ?? "",
  };
  if (damageRaw.versatile_dice) damage.versatile_dice = damageRaw.versatile_dice;

  const out: WeaponCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    category: (base.category as string | undefined) ?? "",
    damage,
    properties: (base.properties as string[] | undefined) ?? [],
  };

  if (base.range && typeof base.range === "object") {
    const r = base.range as { normal?: number; long?: number };
    if (typeof r.normal === "number" && typeof r.long === "number") {
      out.range = { normal: r.normal, long: r.long };
    }
  }
  if (typeof base.cost === "string") out.cost = base.cost;
  if (typeof base.weight === "number" || typeof base.weight === "string") {
    out.weight = base.weight;
  }

  // Structured-rules enrichment (2024): mastery property
  if (Array.isArray(structured?.mastery)) {
    out.mastery = structured.mastery as string[];
  }

  return out;
}
