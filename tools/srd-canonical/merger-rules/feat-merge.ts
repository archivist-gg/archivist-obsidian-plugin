import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";

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
}

export const featMergeRule: MergeRule = {
  kind: "feat",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Feat action economy comes from the foundry activation companion, not overlay.
    return null;
  },
};

const ABILITY_KEYS = new Set(["str", "dex", "con", "int", "wis", "cha"]);

export function toFeatCanonical(entry: CanonicalEntry): FeatCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const activation = entry.activation as Record<string, unknown> | null;

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
