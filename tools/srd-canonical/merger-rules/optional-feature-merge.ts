import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import type { StructuredEntry } from "../sources/structured-rules";
import type { OptionalFeatureEntity } from "../../../src/modules/optional-feature/optional-feature.types";
import {
  normalizeOptionalFeature,
  type StructuredOptionalFeatureInput,
} from "../../../src/modules/optional-feature/optional-feature.normalizer";
import { slugifyName } from "../sources/slug-normalize";

export const optionalFeatureMergeRule: MergeRule = {
  kind: "optional-feature",
  pickOverlay(overlay: Overlay): unknown {
    return overlay.optional_feature_slugs ?? null;
  },
};

export interface MergeOptionalFeatureOptions {
  edition: "2014" | "2024";
  structured: StructuredEntry[];   // from optionalfeatures.json
  overlay: Overlay;
}

/**
 * Merge optional-features by filtering structured-rules to overlay slugs.
 *
 * This rule diverges from the Open5e-driven canonical pattern because Open5e
 * does not expose optional features. The overlay's `optional_feature_slugs`
 * map is the slug gatekeeper here.
 */
export function mergeOptionalFeatures(opts: MergeOptionalFeatureOptions): OptionalFeatureEntity[] {
  const slugSet = new Set<string>();
  for (const list of Object.values(opts.overlay.optional_feature_slugs ?? {})) {
    for (const slug of list) slugSet.add(slug);
  }

  const out: OptionalFeatureEntity[] = [];
  for (const e of opts.structured) {
    const slug = slugifyName(e.name);
    if (!slugSet.has(slug)) continue;

    const featureTypeTags = (e.featureType as string[] | undefined) ?? [];
    const input: StructuredOptionalFeatureInput = {
      name: e.name,
      source: e.source,
      featureType: featureTypeTags,
      entries: (e.entries as unknown[]) ?? [],
      prerequisite: (e.prerequisite as Array<Record<string, unknown>> | undefined),
      edition: opts.edition,
      className: e.className as string | undefined,
      classSource: e.classSource as string | undefined,
    };

    const normalized = normalizeOptionalFeature(input);
    // Apply compendium-prefixed slug (mirrors mergeKind's buildCanonicalSlug).
    normalized.data.slug = `${opts.edition === "2014" ? "srd-5e" : "srd-2024"}_${normalized.data.slug}`;
    out.push(normalized.data);
  }

  return out;
}

/**
 * Canonical-rule glue. The actual workhorse is mergeOptionalFeatures();
 * this shim exists for Task 8.14's wiring consistency.
 *
 * Given a CanonicalEntry, this is a no-op fallback (returns the data field
 * untouched) — Task 8.14 should call mergeOptionalFeatures() directly for
 * this kind rather than going through mergeKind().
 */
export function toOptionalFeatureCanonical(entry: CanonicalEntry): OptionalFeatureEntity {
  return entry.base as unknown as OptionalFeatureEntity;
}
