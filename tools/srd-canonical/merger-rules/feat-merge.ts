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

  const prerequisites = translatePrerequisites(structured?.prerequisite);
  const repeatable = structured?._isRepeatable === true;

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
