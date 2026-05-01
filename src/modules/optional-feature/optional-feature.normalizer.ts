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

const CLASS_TAG_TO_SLUG: Record<string, string> = {
  "I": "warlock",
  "MM": "sorcerer",
  "FS:F": "fighter",
  "FS:P": "paladin",
  "FS:R": "ranger",
  "FS:B": "ranger",
  "MV:B": "fighter",
  "AI": "artificer",
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
  console.warn(`[optional-feature] unknown feature_type tag(s): ${tags.join(", ")}; defaulting to "invocation"`);
  return "invocation";
}

function tagsToAvailableTo(tags: string[], compendium: string): string[] {
  const slugs = new Set<string>();
  for (const t of tags) {
    const slug = CLASS_TAG_TO_SLUG[t];
    if (slug) slugs.add(slug);
  }
  return Array.from(slugs).sort().map(slug => `[[${compendium}/${slug}]]`);
}

const PACT_VALUES = ["tome", "blade", "chain", "talisman"] as const;
type PactBoon = typeof PACT_VALUES[number];
const PACT_SET: ReadonlySet<string> = new Set(PACT_VALUES);

const ABILITY_VALUES = ["str", "dex", "con", "int", "wis", "cha"] as const;
type Ability = typeof ABILITY_VALUES[number];
const ABILITY_SET: ReadonlySet<string> = new Set(ABILITY_VALUES);

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
        if (PACT_SET.has(pact)) {
          out.push({ kind: "pact", pact: pact as PactBoon });
        }
      }
    }
    if (p.ability && typeof p.ability === "object" && !Array.isArray(p.ability)) {
      for (const [ability, min] of Object.entries(p.ability as Record<string, unknown>)) {
        if (typeof min !== "number") continue;
        if (!ABILITY_SET.has(ability)) continue;
        out.push({ kind: "ability", ability: ability as Ability, min });
      }
    }
    if (p.class && typeof p.class === "object" && !Array.isArray(p.class)) {
      for (const [slug, flag] of Object.entries(p.class as Record<string, unknown>)) {
        if (!flag) continue;
        const cleanSlug = slug.replace(/\s+/g, "-").toLowerCase();
        out.push({ kind: "class", class: `[[${compendium}/${cleanSlug}]]` });
      }
    }
    // race and feat prereqs intentionally dropped: OptionalFeaturePrerequisite
    // union does not accept those kinds (see optional-feature.types.ts).
  }
  return out;
}

function flattenEntries(entries: unknown[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (typeof e === "string") {
      out.push(e);
      continue;
    }
    if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        for (const item of obj.items) {
          if (typeof item === "string") out.push(item);
          else if (item && typeof item === "object") {
            // list items can themselves be entry objects (e.g. {type: "item", entries: [...]})
            const itemObj = item as Record<string, unknown>;
            if (Array.isArray(itemObj.entries)) {
              out.push(...flattenEntries(itemObj.entries));
            }
          }
        }
      }
      if (Array.isArray(obj.entries)) {
        out.push(...flattenEntries(obj.entries));
      }
    }
  }
  return out;
}

function entriesToDescription(entries: unknown[]): string {
  return flattenEntries(entries).filter(Boolean).join("\n\n");
}

export function normalizeOptionalFeature(input: StructuredOptionalFeatureInput): NormalizedEntity<OptionalFeatureEntity> {
  const featureType = pickFeatureType(input.featureType);
  const compendium = input.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const data: OptionalFeatureEntity = {
    slug,
    name: input.name,
    edition: input.edition,
    // Canonical SRD label; input.source (e.g. "PHB") is intentionally discarded.
    source: input.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    feature_type: featureType,
    description: entriesToDescription(input.entries),
    prerequisites: normalizePrerequisites(input, compendium),
    available_to: tagsToAvailableTo(input.featureType, compendium),
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
