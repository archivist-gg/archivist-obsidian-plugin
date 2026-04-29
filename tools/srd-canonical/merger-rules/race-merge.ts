import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";

export interface RaceCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  size: "tiny" | "small" | "medium" | "large" | "huge";
  speed: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  vision?: string;
  description: string;
  subspecies_of?: string;
  traits: RaceTrait[];
  additional_spells?: {
    known?: Record<string, string[]>;
    innate?: Record<string, string[]>;
  };
}

export interface RaceTrait {
  name: string;
  desc: string;
  action_cost?: "action" | "bonus-action" | "reaction" | "free" | "special";
  save?: { ability: string; dc_formula: string };
  damage?: { dice: string; type: string };
  recharge?: "short-rest" | "long-rest" | "dawn" | "dusk" | "turn" | "round" | "custom";
}

export const raceMergeRule: MergeRule = {
  kind: "race",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Race overlay is keyed by trait-slug, not race-slug. Pass the entire race_traits map;
    // toRaceCanonical handles per-trait lookup.
    return overlay.race_traits ?? null;
  },
};

const SIZE_MAP: Record<string, RaceCanonical["size"]> = {
  Tiny: "tiny", Small: "small", Medium: "medium", Large: "large", Huge: "huge",
};

export function toRaceCanonical(entry: CanonicalEntry): RaceCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const overlay = entry.overlay as Record<string, RaceTrait> | null;

  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const baseTraits = (base.traits ?? []) as Array<{ name: string; desc?: string; type?: string }>;

  const traits: RaceTrait[] = baseTraits.map(t => {
    const traitSlug = slugifyName(t.name);
    const overlaid = overlay?.[traitSlug];
    return {
      name: t.name,
      desc: rewriteCrossRefs(t.desc ?? "", entry.edition),
      ...(overlaid?.action_cost ? { action_cost: overlaid.action_cost } : {}),
      ...(overlaid?.save ? { save: overlaid.save } : {}),
      ...(overlaid?.damage ? { damage: overlaid.damage } : {}),
      ...(overlaid?.recharge ? { recharge: overlaid.recharge } : {}),
    };
  });

  const out: RaceCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    size: SIZE_MAP[base.size as string] ?? "medium",
    speed: (base.speed as RaceCanonical["speed"] | undefined) ?? {},
    vision: base.vision as string | undefined,
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    traits,
  };

  // Structured-rules enrichment: additionalSpells (source shape)
  if (structured?.additionalSpells) {
    const addSpells = structured.additionalSpells as Array<Record<string, Record<string, string[]>>>;
    const innate: Record<string, string[]> = {};
    const known: Record<string, string[]> = {};
    for (const block of addSpells) {
      for (const [level, spells] of Object.entries(block.innate ?? {})) {
        innate[level] = spells.map(s => `[[${compendium}/Spells/${titleCase(s)}|${s}]]`);
      }
      for (const [level, spells] of Object.entries(block.known ?? {})) {
        known[level] = spells.map(s => `[[${compendium}/Spells/${titleCase(s)}|${s}]]`);
      }
    }
    out.additional_spells = {};
    if (Object.keys(innate).length > 0) out.additional_spells.innate = innate;
    if (Object.keys(known).length > 0) out.additional_spells.known = known;
  }

  // Subspecies linkage (source `_copy` parent reference)
  if (structured?._copy) {
    const parent = (structured._copy as { name: string }).name;
    out.subspecies_of = `[[${compendium}/${parent}]]`;
  }

  return out;
}

function titleCase(s: string): string {
  return s.split(/[\s-]+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
