import type { FeatEntity, FeatPrerequisite } from "./feat.types";
import type { Edition } from "../class/class.types";
import type { NormalizedEntity } from "../class/class.normalizer";

export interface Open5eFeatJson {
  name: string;
  slug: string;
  desc?: string;
  prerequisite?: string;
  effects_desc?: string[];
  document__slug?: string;
}

function parsePrerequisites(raw: string | undefined): FeatPrerequisite[] {
  if (!raw) return [];
  const out: FeatPrerequisite[] = [];
  const abilityMatch = /(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)/i.exec(raw);
  if (abilityMatch) {
    const map = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" } as const;
    out.push({ kind: "ability", ability: map[abilityMatch[1].toLowerCase() as keyof typeof map], min: Number(abilityMatch[2]) });
  }
  return out;
}

function parseBenefits(effects_desc: string[] | undefined, desc: string | undefined): string[] {
  if (effects_desc && effects_desc.length > 0) return effects_desc;
  if (!desc) return [];
  return desc.split("\n").map((l) => l.trim())
    .filter((l) => l.startsWith("*") || l.startsWith("-"))
    .map((l) => l.replace(/^[*-]\s*/, ""));
}

export function normalizeSrdFeat(
  input: Open5eFeatJson,
  opts: { edition?: Edition; compendium?: string } = {},
): NormalizedEntity<FeatEntity> {
  const edition = opts.edition ?? "2014";
  const compendium = opts.compendium ?? "SRD";

  const data: FeatEntity = {
    slug: input.slug,
    name: input.name,
    edition,
    source: "SRD 5.1",
    category: "general",
    description: input.desc ?? "",
    prerequisites: parsePrerequisites(input.prerequisite),
    benefits: parseBenefits(input.effects_desc, input.desc),
    effects: [],
    grants_asi: null,
    repeatable: false,
    choices: [],
  };

  return {
    frontmatter: {
      archivist: true,
      entity_type: "feat",
      slug: data.slug,
      name: data.name,
      compendium,
      source: data.source,
    },
    data,
  };
}
