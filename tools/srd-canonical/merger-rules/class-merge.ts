import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";

export interface ClassCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  hit_dice: string;
  features: ClassFeature[];
  spellcasting?: { ability: string; type: "full" | "half" | "third" | "pact"; prepared?: boolean };
  resources?: Array<{ name: string; max_formula: string; reset: string }>;
  proficiencies?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    saves?: string[];
    skills?: { count: number; from: string[] };
  };
  multiclassing?: { requirements: Record<string, number>; gains: { proficiencies?: string[] } };
  /** 2024 only — count of weapons that can be selected for weapon mastery. */
  weapon_mastery_count?: number;
}

export interface ClassFeature {
  level: number;
  name: string;
  desc: string;
  action_cost?: "action" | "bonus-action" | "reaction" | "free" | "special";
  uses?: {
    max: number | string;
    recharge?: string;
    scales_at?: Array<{ level: number; value?: number | string; max?: number | string }>;
  };
  scales_at?: Array<{ level: number; damage?: { dice: string }; max?: number | string }>;
}

export const classMergeRule: MergeRule = {
  kind: "class",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Class overlay is keyed by feature-slug, not class-slug. Pass the full class_features map;
    // toClassCanonical handles per-feature lookup.
    return overlay.class_features ?? null;
  },
};

type SpellcastingType = "full" | "half" | "third" | "pact";

const PROGRESSION_MAP: Record<string, SpellcastingType> = {
  full: "full",
  half: "half",
  third: "third",
  pact: "pact",
};

export function toClassCanonical(entry: CanonicalEntry): ClassCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const overlay = entry.overlay as Record<string, ClassFeature> | null;

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

  const out: ClassCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    hit_dice: (base.hit_dice as string) ?? "",
    features,
  };

  // Open5e proficiency strings → arrays
  const proficiencies = buildProficiencies(base);
  if (proficiencies) out.proficiencies = proficiencies;

  // Structured-rules enrichment
  if (structured?.spellcasting) {
    const sc = structured.spellcasting as { ability?: string; progression?: string; prepared?: boolean };
    if (sc.ability && sc.progression) {
      const type = PROGRESSION_MAP[sc.progression];
      if (type) {
        out.spellcasting = {
          ability: sc.ability,
          type,
          ...(typeof sc.prepared === "boolean" ? { prepared: sc.prepared } : {}),
        };
      }
    }
  }

  if (Array.isArray(structured?.resources)) {
    out.resources = (structured.resources as Array<{ name: string; max_formula: string; reset: string }>);
  }

  if (typeof structured?.weapon_mastery_count === "number") {
    out.weapon_mastery_count = structured.weapon_mastery_count;
  }

  if (structured?.multiclassing) {
    const mc = structured.multiclassing as { requirements?: Record<string, number>; gains?: { proficiencies?: string[] } };
    out.multiclassing = {
      requirements: mc.requirements ?? {},
      gains: { ...(mc.gains?.proficiencies ? { proficiencies: mc.gains.proficiencies } : {}) },
    };
  }

  return out;
}

function splitProfList(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/,\s*|\s+and\s+/i)
    .map(t => t.trim())
    .filter(Boolean);
}

function buildProficiencies(base: Record<string, unknown>): ClassCanonical["proficiencies"] | undefined {
  const armor = splitProfList(base.prof_armor as string | undefined);
  const weapons = splitProfList(base.prof_weapons as string | undefined);
  const tools = splitProfList(base.prof_tools as string | undefined);
  const saves = splitProfList(base.prof_saving_throws as string | undefined);

  const skillsRaw = (base.prof_skills as string | undefined) ?? "";
  let skills: { count: number; from: string[] } | undefined;
  const m = skillsRaw.match(/Choose\s+(\w+)\s+from\s+(.+)/i);
  if (m) {
    const countWord = m[1].toLowerCase();
    const numberMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const parsedNumber = Number.parseInt(countWord, 10);
    const count = numberMap[countWord] ?? (Number.isNaN(parsedNumber) ? 0 : parsedNumber);
    const from = splitProfList(m[2].replace(/\.$/, ""));
    skills = { count, from };
  }

  if (!armor.length && !weapons.length && !tools.length && !saves.length && !skills) return undefined;
  return {
    ...(armor.length ? { armor } : {}),
    ...(weapons.length ? { weapons } : {}),
    ...(tools.length ? { tools } : {}),
    ...(saves.length ? { saves } : {}),
    ...(skills ? { skills } : {}),
  };
}
