import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface ConditionCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  /** Future-extensible structured effects (e.g., "advantage on saves vs charm"). */
  effects?: string[];
}

export const conditionMergeRule: MergeRule = {
  kind: "condition",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Conditions are fully captured by Open5e desc; no overlay needed.
    return null;
  },
};

export function toConditionCanonical(entry: CanonicalEntry): ConditionCanonical {
  const base = entry.base as Record<string, unknown>;

  return {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
  };
}
