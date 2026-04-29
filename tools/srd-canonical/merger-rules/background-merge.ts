import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface BackgroundCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  skill_proficiencies: string[];
  tool_proficiencies: string[];
  languages: string[];
  equipment: string[];
  feature: { name: string; desc: string };
  /** 2024 only — three-point pool the player distributes across abilities. */
  ability_score_increases?: { count: number; applies_to: "any" };
  /** 2024 only — wikilink to the origin feat granted by this background. */
  origin_feat?: string;
}

export const backgroundMergeRule: MergeRule = {
  kind: "background",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Backgrounds rarely require overlay — leave for later if needed.
    return null;
  },
};

export function toBackgroundCanonical(entry: CanonicalEntry): BackgroundCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;

  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";

  const out: BackgroundCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    skill_proficiencies: splitFreeText(base.skill_proficiencies as string | undefined),
    tool_proficiencies: splitFreeText(base.tool_proficiencies as string | undefined),
    languages: splitFreeText(base.language_proficiencies as string | undefined),
    equipment: splitFreeText(base.equipment as string | undefined),
    feature: {
      name: (base.feature as string | undefined) ?? "",
      desc: rewriteCrossRefs((base.feature_desc as string | undefined) ?? "", entry.edition),
    },
  };

  // Structured-rules (2024) — origin feat
  if (Array.isArray(structured?.feats)) {
    const featList = structured.feats as Array<{ name?: string }>;
    const first = featList.find(f => typeof f.name === "string");
    if (first?.name) {
      out.origin_feat = `[[${compendium}/Feats/${slugToTitle(first.name)}]]`;
    }
  }

  // Structured-rules (2024) — ASI pool
  const asi = structured?.abilityScoreImprovement as { count?: number } | undefined;
  if (asi && typeof asi.count === "number") {
    out.ability_score_increases = { count: asi.count, applies_to: "any" };
  }

  return out;
}

function splitFreeText(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/,\s*|\s+and\s+/i)
    .map(t => t.trim())
    .filter(Boolean);
}

function slugToTitle(slug: string): string {
  return slug
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
