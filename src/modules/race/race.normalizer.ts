import type { RaceEntity, AbilityScoreIncrease, Size } from "./race.types";
import type { Feature, Ability } from "../../shared/types";
import type { Edition } from "../class/class.types";
import type { NormalizedEntity } from "../class/class.normalizer";

export interface Open5eRaceJson {
  name: string;
  slug: string;
  desc?: string;
  asi_desc?: string;
  asi?: Array<{ attributes: string[]; value: number }>;
  age?: string;
  alignment?: string;
  size?: string;
  size_raw?: string;
  speed?: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  speed_desc?: string;
  languages?: string;
  vision?: string;
  traits?: string;
  subraces?: Array<Record<string, unknown>>;
  document__slug?: string;
}

const ABILITY_NAME_TO_SLUG: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

function normalizeSize(raw: string | undefined): Size {
  const s = (raw ?? "medium").toLowerCase();
  if (s.includes("tiny")) return "tiny";
  if (s.includes("small")) return "small";
  if (s.includes("large")) return "large";
  if (s.includes("huge")) return "huge";
  return "medium";
}

function normalizeAsi(open5eAsi: Open5eRaceJson["asi"]): AbilityScoreIncrease[] {
  if (!open5eAsi) return [];
  const out: AbilityScoreIncrease[] = [];
  for (const entry of open5eAsi) {
    for (const name of entry.attributes) {
      const slug = ABILITY_NAME_TO_SLUG[name.toLowerCase()];
      if (slug) out.push({ ability: slug, amount: entry.value });
    }
  }
  return out;
}

function parseDarkvision(vision: string | undefined): number {
  if (!vision) return 0;
  const m = /(\d+)\s*(?:ft|feet)/i.exec(vision);
  return m ? Number(m[1]) : 0;
}

function parseLanguages(raw: string | undefined): RaceEntity["languages"] {
  if (!raw) return { fixed: [] };
  const fixed: string[] = [];
  const lc = raw.toLowerCase();
  for (const lang of ["common", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling", "orc", "draconic", "celestial", "infernal", "abyssal"]) {
    if (lc.includes(lang)) fixed.push(lang);
  }
  const hasChoice = /one extra language of your choice/i.test(raw);
  const languages: RaceEntity["languages"] = { fixed };
  if (hasChoice) languages.choice = { count: 1, from: "any" };
  return languages;
}

function parseTraits(raw: string | undefined): Feature[] {
  if (!raw) return [];
  const sections = raw.split(/\n(?=_\*\*|\*\*)/);
  const out: Feature[] = [];
  for (const section of sections) {
    const nameMatch = /\*\*(.+?)\.?\*\*/.exec(section);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    const body = section.substring(nameMatch[0].length).trim();
    out.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      description: body,
    });
  }
  return out;
}

export function normalizeSrdRace(
  input: Open5eRaceJson,
  opts: { edition?: Edition; compendium?: string } = {},
): NormalizedEntity<RaceEntity> {
  const edition = opts.edition ?? "2014";
  const compendium = opts.compendium ?? "SRD";

  const data: RaceEntity = {
    slug: input.slug,
    name: input.name,
    edition,
    source: "SRD 5.1",
    description: input.desc ?? "",
    size: normalizeSize(input.size ?? input.size_raw),
    speed: input.speed ?? { walk: 30 },
    ability_score_increases: edition === "2014" ? normalizeAsi(input.asi) : [],
    age: input.age ?? "",
    alignment: input.alignment ?? "",
    vision: { darkvision: parseDarkvision(input.vision) || undefined },
    languages: parseLanguages(input.languages),
    variant_label: "Subrace",
    variants: [],
    traits: parseTraits(input.traits),
  };

  return {
    frontmatter: {
      archivist: true,
      entity_type: "race",
      slug: data.slug,
      name: data.name,
      compendium,
      source: data.source,
    },
    data,
  };
}
