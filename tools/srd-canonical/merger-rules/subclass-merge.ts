import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";
import type { ClassFeatureOut } from "./class-merge";

/**
 * Open5e v2 class-endpoint feature shape (subset). Mirrors the type in
 * class-merge so subclass-merge can apply the same gained_at[] bucketing
 * and feature_type filter.
 */
interface Open5eClassFeature {
  key: string;
  name: string;
  desc: string;
  feature_type: string;
  gained_at?: Array<{ level: number; detail: string | null }>;
  data_for_class_table?: Array<{ level: number; column_value: string }>;
}

/**
 * SubclassCanonical mirrors the runtime SubclassEntity shape
 * (src/modules/subclass/subclass.schema.ts) so the emitted YAML in
 * `.compendium-bundle/<compendium>/Subclasses/*.md` parses through
 * `parseSubclass` without a translation layer.
 */
export interface SubclassCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  /** Wikilink to parent class compendium page, e.g. `[[SRD 5e/Classes/Fighter]]`. */
  parent_class: string;
  features_by_level: Record<string, ClassFeatureOut[]>;
  resources: never[];
}

export const subclassMergeRule: MergeRule = {
  kind: "subclass",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Subclass features share the class_features overlay namespace, keyed by feature-slug.
    return overlay.class_features ?? null;
  },
};

/**
 * Title-case a derived parent name. Handles inputs like "srd_fighter",
 * "srd-2024_fighter", "rogue", or "open-hand".
 */
function deriveParentNameFromString(raw: string): string {
  // Strip Open5e document prefixes like "srd_" or "srd-2024_".
  let cleaned = raw.replace(/^srd[-_]?(?:2024)?[_-]?/i, "");
  cleaned = cleaned.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function resolveParentName(subclassOf: unknown): string {
  if (subclassOf && typeof subclassOf === "object") {
    const obj = subclassOf as { name?: string; key?: string };
    if (obj.name && obj.name.length > 0) return obj.name;
    if (obj.key && obj.key.length > 0) return deriveParentNameFromString(obj.key);
  }
  if (typeof subclassOf === "string") {
    return deriveParentNameFromString(subclassOf);
  }
  return "";
}

/**
 * Bucket subclass features by their gained_at[] levels. Mirrors the
 * class-merge bucketer: filter to CLASS_LEVEL_FEATURE only (drop
 * CLASS_TABLE_DATA / PROFICIENCIES / etc. noise), then expand each feature
 * across every level it is gained at.
 */
function bucketFeaturesByLevel(
  features: Open5eClassFeature[],
  edition: "2014" | "2024",
  overlay: Record<string, ClassFeatureOut> | null,
): Record<string, ClassFeatureOut[]> {
  const out: Record<string, ClassFeatureOut[]> = {};
  for (const f of features) {
    if (f.feature_type !== "CLASS_LEVEL_FEATURE") continue;
    const featureSlug = slugifyName(f.name);
    const overlaid = overlay?.[featureSlug];
    const description = rewriteCrossRefs(f.desc ?? "", edition);
    const desc = description && description.length > 0 ? description : f.name;
    const levels = (f.gained_at ?? []).map(g => g.level).filter(n => Number.isFinite(n));
    const seen = new Set<number>();
    for (const lvl of levels) {
      if (seen.has(lvl)) continue;
      seen.add(lvl);
      const feature: ClassFeatureOut = {
        id: featureSlug,
        name: f.name,
        description: desc,
        ...(overlaid?.action ? { action: overlaid.action } : {}),
        ...(overlaid?.uses ? { uses: overlaid.uses } : {}),
        ...(overlaid?.scales_at ? { scales_at: overlaid.scales_at } : {}),
      };
      const key = String(lvl);
      out[key] ??= [];
      out[key].push(feature);
    }
  }
  return out;
}

export function toSubclassCanonical(entry: CanonicalEntry): SubclassCanonical {
  const base = entry.base as Record<string, unknown>;
  const overlay = entry.overlay as Record<string, ClassFeatureOut> | null;

  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const parentName = resolveParentName(base.subclass_of);

  const baseFeatures = (base.features ?? []) as Open5eClassFeature[];
  const features_by_level = bucketFeaturesByLevel(baseFeatures, entry.edition, overlay);

  return {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    parent_class: `[[${compendium}/Classes/${parentName}]]`,
    features_by_level,
    resources: [],
  };
}
