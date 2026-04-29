import type { OptionalFeatureEntity, OptionalFeatureKind, OptionalFeaturePrerequisite } from "./optional-feature.types";
import type { NormalizedEntity } from "../class/class.normalizer";

const FEATURE_TYPE_TAG_MAP: Record<string, OptionalFeatureKind> = {
  "I": "invocation",
  "MM": "metamagic",
  "FS:F": "fighting_style",
  "FS:P": "fighting_style",
  "FS:R": "fighting_style",
  "FS:B": "fighting_style",   // ranger conclave
  "MV:B": "maneuver",
  "AI": "infusion",
};

const CLASS_TAG_TO_WIKILINK: Record<string, string> = {
  "I": "[[SRD 5e/warlock]]",
  "MM": "[[SRD 5e/sorcerer]]",
  "FS:F": "[[SRD 5e/fighter]]",
  "FS:P": "[[SRD 5e/paladin]]",
  "FS:R": "[[SRD 5e/ranger]]",
  "MV:B": "[[SRD 5e/fighter]]",
  "AI": "[[SRD 5e/artificer]]",
};

export interface StructuredOptionalFeatureInput {
  name: string;
  source: string;
  featureType: string[];
  entries: unknown[];
  prerequisite?: Array<Record<string, unknown>>;
  edition: "2014" | "2024";
  className?: string;
  classSource?: string;
  // …other source-shape fields tolerated
}

function pickFeatureType(tags: string[]): OptionalFeatureKind {
  for (const t of tags) {
    if (FEATURE_TYPE_TAG_MAP[t]) return FEATURE_TYPE_TAG_MAP[t];
  }
  return "invocation"; // safest default for unknown invocation-shaped entries
}

function tagsToAvailableTo(tags: string[], edition: "2014" | "2024"): string[] {
  const compendium = edition === "2014" ? "SRD 5e" : "SRD 2024";
  const links = new Set<string>();
  for (const t of tags) {
    const link = CLASS_TAG_TO_WIKILINK[t];
    if (link) links.add(link.replace("SRD 5e", compendium));
  }
  return Array.from(links).sort();
}

const PACT_VALUES = new Set(["tome", "blade", "chain", "talisman"] as const);
type PactBoon = "tome" | "blade" | "chain" | "talisman";

function normalizePrerequisites(
  input: StructuredOptionalFeatureInput,
  compendium: string,
): OptionalFeaturePrerequisite[] {
  if (!input.prerequisite) return [];
  const out: OptionalFeaturePrerequisite[] = [];
  for (const p of input.prerequisite) {
    if (Array.isArray(p.spell)) {
      for (const s of p.spell as string[]) {
        const slug = s.split("#")[0].replace(/\s+/g, "-").toLowerCase();
        out.push({ kind: "spell-known", spell: `[[${compendium}/${slug}]]` });
      }
    }
    if (typeof p.level === "number") out.push({ kind: "level", min: p.level });
    if (Array.isArray(p.pact)) {
      for (const pact of p.pact as string[]) {
        if (PACT_VALUES.has(pact as PactBoon)) {
          out.push({ kind: "pact", pact: pact as PactBoon });
        }
      }
    }
    // ability score, class, other prereq kinds: extend as needed.
    // Each push must satisfy the discriminated union's full required-field set
    // for that `kind` (e.g. `{ kind: "ability", ability, min }`,
    // `{ kind: "class", class }`, `{ kind: "other", detail }`).
  }
  return out;
}

function entriesToDescription(entries: unknown[]): string {
  return entries.map(e => typeof e === "string" ? e : "").filter(Boolean).join("\n\n");
}

export function normalizeOptionalFeature(input: StructuredOptionalFeatureInput): NormalizedEntity<OptionalFeatureEntity> {
  const featureType = pickFeatureType(input.featureType);
  const compendium = input.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const data: OptionalFeatureEntity = {
    slug,
    name: input.name,
    edition: input.edition,
    source: input.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    feature_type: featureType,
    description: entriesToDescription(input.entries),
    prerequisites: normalizePrerequisites(input, compendium),
    available_to: tagsToAvailableTo(input.featureType, input.edition),
    effects: [],
  };
  return {
    frontmatter: {
      archivist: true,
      entity_type: "optional-feature",
      slug,
      name: input.name,
      compendium,
      source: data.source,
    },
    data,
  };
}
