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

const SIZE_PARSE_REGEX = /\b(tiny|small|medium|large|huge)\b/i;
const SPEED_PARSE_REGEX = /(\d+)\s*(?:feet|ft\.?)/i;

interface OpenTrait {
  name: string;
  desc: string;
  type?: string | null;
}

/**
 * Open5e v2 species expose Size in two shapes:
 *   - 2024: a trait with `type === "SIZE"` and a desc starting with the size name.
 *   - 2014: an untyped trait with `name === "Size"` and a free-text desc that
 *     embeds the size word (e.g. "Your size is Medium.").
 * We probe the typed variant first, then fall back to name-matching, and
 * finally regex the desc for the canonical size token.
 */
function extractSizeFromTraits(traits: OpenTrait[]): RaceCanonical["size"] {
  let sizeTrait = traits.find(t => t.type === "SIZE");
  if (!sizeTrait) sizeTrait = traits.find(t => t.name?.toLowerCase() === "size");
  if (!sizeTrait) return "medium";
  const m = sizeTrait.desc.match(SIZE_PARSE_REGEX);
  return (m ? m[1].toLowerCase() : "medium") as RaceCanonical["size"];
}

/**
 * Speed extraction handles the same two shapes as size. The first integer
 * followed by "feet"/"ft." in the desc is treated as walking speed. We then
 * look for additional movement modes (fly/swim/climb/burrow) by scanning for
 * `<mode> <integer>` in the same desc.
 */
function extractSpeedFromTraits(traits: OpenTrait[]): RaceCanonical["speed"] {
  let speedTrait = traits.find(t => t.type === "SPEED");
  if (!speedTrait) speedTrait = traits.find(t => t.name?.toLowerCase() === "speed");
  if (!speedTrait) return {};
  const speed: RaceCanonical["speed"] = {};
  const walkMatch = speedTrait.desc.match(SPEED_PARSE_REGEX);
  if (walkMatch) speed.walk = parseInt(walkMatch[1], 10);
  for (const mode of ["fly", "swim", "climb", "burrow"] as const) {
    const re = new RegExp(`${mode}\\s+(?:speed\\s+(?:of\\s+)?)?(\\d+)`, "i");
    const m = speedTrait.desc.match(re);
    if (m) speed[mode] = parseInt(m[1], 10);
  }
  return speed;
}

/**
 * Resolve the Open5e v2 `subspecies_of` field to a parent display name. v2
 * exposes both shapes in the wild:
 *   - object: `{ name: "Dwarf", key: "srd_dwarf" }` (planned API enrichment)
 *   - string: `"srd_dwarf"` (current cache shape — bare key)
 * Returns the display name when known, or null when no parent is set.
 */
function resolveSubspeciesParent(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null) {
    const name = (value as { name?: string }).name;
    if (typeof name === "string" && name.length > 0) return name;
  }
  if (typeof value === "string" && value.length > 0) {
    // Bare Open5e key like "srd_dwarf" or "srd-2024_dwarf". Strip the
    // edition-prefix and title-case the trailing slug. This is best-effort —
    // the name lookup against the loaded slugSet would be more robust, but
    // requires plumbing not currently available in the merger boundary.
    const trailing = value.replace(/^srd(?:-2024)?_/, "");
    return titleCase(trailing);
  }
  return null;
}

export function toRaceCanonical(entry: CanonicalEntry): RaceCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const overlay = entry.overlay as Record<string, RaceTrait> | null;

  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";
  const baseTraits = (base.traits ?? []) as Array<{ name: string; desc?: string; type?: string | null; order?: number | null }>;

  const normalizedTraits: OpenTrait[] = baseTraits.map(t => ({
    name: t.name,
    desc: t.desc ?? "",
    type: t.type ?? null,
  }));

  const size = extractSizeFromTraits(normalizedTraits);
  const speed = extractSpeedFromTraits(normalizedTraits);

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
    size,
    speed,
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    traits,
  };

  // Native Open5e v2 subspecies_of (object or string-key shape).
  const parentName = resolveSubspeciesParent(base.subspecies_of);
  if (parentName) {
    out.subspecies_of = `[[${compendium}/Races/${parentName}]]`;
  }

  // Structured-rules enrichment: additionalSpells (now unblocked by Phase 1).
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

  return out;
}

function titleCase(s: string): string {
  return s.split(/[\s-]+/).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
