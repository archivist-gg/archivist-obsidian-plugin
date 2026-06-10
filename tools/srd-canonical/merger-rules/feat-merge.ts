import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";
import type { Resource } from "../../../src/shared/types/resource";
import type { Choice } from "../../../src/shared/types/choice";

export type FeatPrerequisite =
  | { kind: "level"; min: number }
  | { kind: "ability"; ability: "str" | "dex" | "con" | "int" | "wis" | "cha"; min: number }
  | { kind: "feat"; slug: string }
  | { kind: "spell"; slug: string }
  | { kind: "class"; slug: string }
  | { kind: "race"; slug: string };

export interface FeatCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  category: "origin" | "general";
  prerequisites: FeatPrerequisite[];
  benefits: string[];
  repeatable: boolean;
  action_cost?: "action" | "bonus-action" | "reaction" | "free" | "special";
  /**
   * Schema-required fields. Phase 9 emits minimal safe defaults so the runtime
   * parser accepts the bundle MD; future enrichment may populate these from
   * structured-rules data.
   */
  effects: unknown[];
  grants_asi: { amount: number; pool?: string[] } | null;
  choices: Choice[];
  resources?: Resource[];
}

export const featMergeRule: MergeRule = {
  kind: "feat",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Per-feat limited-use resources and feature-level choices come from
    // feat_features; entity-level effects come from the feats: section. Both
    // are keyed by bare feat slug — merge into one per-slug record so
    // toFeatCanonical reads a single map.
    const features = overlay.feat_features ?? {};
    const entities = overlay.feats ?? {};
    const slugs = new Set([...Object.keys(features), ...Object.keys(entities)]);
    if (slugs.size === 0) return null;
    const merged: Record<string, unknown> = {};
    for (const slug of slugs) merged[slug] = { ...features[slug], ...entities[slug] };
    return merged;
  },
};

const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

export function toFeatCanonical(entry: CanonicalEntry): FeatCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const activation = entry.activation as Record<string, unknown> | null;
  const overlay = entry.overlay as Record<
    string,
    { resources?: Resource[]; choices?: Choice[]; effects?: unknown[] }
  > | null;
  const overlaid = overlay?.[slugifyName(base.name as string)];

  const typeStr = ((base.type as string | undefined) ?? "general").toLowerCase();
  const category: FeatCanonical["category"] = typeStr.includes("origin") ? "origin" : "general";

  const benefitArr = (base.benefits ?? []) as Array<{ desc?: string }>;
  const benefits = benefitArr.map(b => rewriteCrossRefs(b.desc ?? "", entry.edition)).filter(Boolean);

  let prerequisites = translatePrerequisites(structured?.prerequisite);
  if (prerequisites.length === 0 && typeof base.prerequisite === "string") {
    prerequisites = parseOpen5ePrerequisiteString(base.prerequisite);
  }
  const repeatable = structured?.repeatable === true || structured?.repeatableHidden === true;

  const out: FeatCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    category,
    prerequisites,
    benefits,
    repeatable,
    // Schema-required defaults (Phase 9). Entity-level effects are authored in
    // the overlay's feats: section (keyed by bare feat slug); default to []
    // when none are present.
    effects: overlaid?.effects ?? [],
    grants_asi: null,
    choices: overlaid?.choices ?? [],
    ...(overlaid?.resources ? { resources: overlaid.resources } : {}),
  };

  // Activation companion → action_cost
  const actionCost = pickActionCostFromActivation(activation);
  if (actionCost) out.action_cost = actionCost;

  return out;
}

function translatePrerequisites(raw: unknown): FeatPrerequisite[] {
  if (!Array.isArray(raw)) return [];
  const out: FeatPrerequisite[] = [];
  for (const block of raw as Array<Record<string, unknown>>) {
    if (typeof block.level === "number") {
      out.push({ kind: "level", min: block.level });
    }
    if (block.ability && typeof block.ability === "object") {
      for (const [ability, min] of Object.entries(block.ability as Record<string, number>)) {
        if (ABILITY_KEYS.has(ability) && typeof min === "number") {
          out.push({ kind: "ability", ability: ability as "str" | "dex" | "con" | "int" | "wis" | "cha", min });
        }
      }
    }
    if (Array.isArray(block.feat)) {
      for (const slug of block.feat as string[]) out.push({ kind: "feat", slug: slugifyName(slug) });
    }
    if (Array.isArray(block.spell)) {
      for (const slug of block.spell as string[]) out.push({ kind: "spell", slug: slugifyName(slug) });
    }
    if (block.class && typeof block.class === "object") {
      for (const [slug, flag] of Object.entries(block.class as Record<string, boolean>)) {
        if (flag) out.push({ kind: "class", slug: slugifyName(slug) });
      }
    }
    if (block.race && typeof block.race === "object") {
      for (const [slug, flag] of Object.entries(block.race as Record<string, boolean>)) {
        if (flag) out.push({ kind: "race", slug: slugifyName(slug) });
      }
    }
  }
  return out;
}

/**
 * Parse Open5e's free-text `prerequisite` string when the structured-rules
 * dump has no entry for this feat (Open5e ships SRD entries that 5etools omits,
 * e.g. Grappler 2014 with `"Strength 13 or higher"`). Handles the common
 * SRD shapes: ability-score thresholds and minimum levels. Other free-text
 * forms (fighting-style features, narrative gates) are intentionally not
 * extracted to avoid speculative parsing.
 */
function parseOpen5ePrerequisiteString(s: string | undefined): FeatPrerequisite[] {
  if (!s) return [];
  const out: FeatPrerequisite[] = [];

  // "Level 4+" / "level 4 or higher" → {kind:"level", min:4}
  const levelMatch = s.match(/level\s+(\d+)/i);
  if (levelMatch) {
    out.push({ kind: "level", min: parseInt(levelMatch[1], 10) });
  }

  // "Strength 13 or higher" / "Strength 13+" → {kind:"ability", ability:"str", min:13}
  // Also handles "Strength or Dexterity 13+" (multiple abilities, single threshold).
  const abilityMap: Record<string, "str" | "dex" | "con" | "int" | "wis" | "cha"> = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha",
  };
  const abilityNames = Array.from(s.matchAll(/(strength|dexterity|constitution|intelligence|wisdom|charisma)/gi))
    .map(match => match[1].toLowerCase());
  if (abilityNames.length > 0) {
    const trailingNum = s.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)[^\d]*?(\d+)/i);
    if (trailingNum) {
      const min = parseInt(trailingNum[2], 10);
      for (const name of abilityNames) {
        out.push({ kind: "ability", ability: abilityMap[name], min });
      }
    }
  }

  return out;
}

function pickActionCostFromActivation(activation: Record<string, unknown> | null): FeatCanonical["action_cost"] {
  if (!activation) return undefined;
  const act = activation.activation as { type?: string } | undefined;
  if (!act?.type) return undefined;
  switch (act.type) {
    case "action": return "action";
    case "bonus": return "bonus-action";
    case "reaction": return "reaction";
    case "special": return "special";
    case "none":
    case "passive":
      return "free";
    default:
      return undefined;
  }
}
