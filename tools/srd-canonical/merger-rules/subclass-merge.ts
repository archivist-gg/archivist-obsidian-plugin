import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";
import type { ClassFeature } from "./class-merge";

export interface SubclassCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  /** Wikilink to parent class compendium page. */
  parent_class: string;
  features: ClassFeature[];
}

export const subclassMergeRule: MergeRule = {
  kind: "subclass",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Subclass features share the class_features overlay namespace, keyed by feature-slug.
    return overlay.class_features ?? null;
  },
};

export function toSubclassCanonical(entry: CanonicalEntry): SubclassCanonical {
  const base = entry.base as Record<string, unknown>;
  const overlay = entry.overlay as Record<string, ClassFeature> | null;

  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const parentSlug = (base.subclass_of as string | undefined) ?? "";

  const baseFeatures = (base.features ?? []) as Array<{ level: number; name: string; desc?: string }>;
  const features: ClassFeature[] = baseFeatures.map(f => {
    const featureSlug = slugifyName(f.name);
    const overlaid = overlay?.[featureSlug];
    return {
      level: f.level,
      name: f.name,
      desc: rewriteCrossRefs(f.desc ?? "", entry.edition),
      ...(overlaid?.action_cost ? { action_cost: overlaid.action_cost } : {}),
      ...(overlaid?.uses ? { uses: overlaid.uses } : {}),
      ...(overlaid?.scales_at ? { scales_at: overlaid.scales_at } : {}),
    };
  });

  return {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    parent_class: `[[${compendium}/${parentSlug}]]`,
    features,
  };
}
