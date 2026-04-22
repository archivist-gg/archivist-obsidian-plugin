import type {
  BackgroundEntity,
  BackgroundEquipmentEntry,
  BackgroundToolProficiency,
  BackgroundLanguageProficiency,
} from "./background.types";
import type { SkillSlug } from "../../shared/types";
import type { Edition } from "../class/class.types";
import type { NormalizedEntity } from "../class/class.normalizer";

export interface Open5eBackgroundJson {
  name: string;
  slug: string;
  desc?: string;
  // Newer open5e shape: one entry per benefit section.
  benefits?: Array<{ name?: string; desc: string; type?: string }>;
  // Legacy/flat SRD JSON shape: top-level string fields.
  skill_proficiencies?: string | null;
  tool_proficiencies?: string | null;
  languages?: string | null;
  equipment?: string | null;
  feature?: string | null;
  feature_desc?: string | null;
  document__slug?: string;
}

const SKILL_NAME_TO_SLUG: Record<string, SkillSlug> = {
  acrobatics: "acrobatics",
  "animal handling": "animal-handling",
  arcana: "arcana",
  athletics: "athletics",
  deception: "deception",
  history: "history",
  insight: "insight",
  intimidation: "intimidation",
  investigation: "investigation",
  medicine: "medicine",
  nature: "nature",
  perception: "perception",
  performance: "performance",
  persuasion: "persuasion",
  religion: "religion",
  "sleight of hand": "sleight-of-hand",
  stealth: "stealth",
  survival: "survival",
};

function findBenefit(benefits: Open5eBackgroundJson["benefits"], predicate: (b: { name?: string; desc: string }) => boolean): string | undefined {
  return benefits?.find((b) => predicate(b))?.desc;
}

function parseSkillProfs(desc: string | undefined): SkillSlug[] {
  if (!desc) return [];
  const out: SkillSlug[] = [];
  for (const [name, slug] of Object.entries(SKILL_NAME_TO_SLUG)) {
    if (desc.toLowerCase().includes(name)) out.push(slug);
  }
  return out;
}

function parseToolProfs(desc: string | undefined): BackgroundToolProficiency[] {
  if (!desc) return [];
  return [{ kind: "fixed", items: [desc.trim().toLowerCase().replace(/\s+/g, "-")] }];
}

function parseLanguages(desc: string | undefined): BackgroundLanguageProficiency[] {
  if (!desc) return [];
  const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3 };
  const withLang = /(\w+)\s+(?:language|languages)/i.exec(desc);
  const bareCount = /^\s*(\w+)\b/.exec(desc);
  const tok = (withLang ?? bareCount)?.[1]?.toLowerCase();
  const n = tok ? (wordToNum[tok] ?? Number(tok)) : NaN;
  return [{ kind: "choice", count: Number.isFinite(n) && n > 0 ? n : 1, from: "any" }];
}

function parseEquipment(desc: string | undefined): BackgroundEquipmentEntry[] {
  if (!desc) return [];
  const items: BackgroundEquipmentEntry[] = [];
  const lines = desc.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  for (const line of lines) {
    const gpMatch = /(\d+)\s*gp/i.exec(line);
    if (gpMatch) { items.push({ kind: "currency", gp: Number(gpMatch[1]) }); continue; }
    items.push({ item: line.toLowerCase().replace(/\s+/g, "-"), quantity: 1 });
  }
  return items;
}

export function normalizeSrdBackground(
  input: Open5eBackgroundJson,
  opts: { edition?: Edition; compendium?: string } = {},
): NormalizedEntity<BackgroundEntity> {
  const edition = opts.edition ?? "2014";
  const compendium = opts.compendium ?? "SRD";

  // Support both shapes: benefits[] (modern open5e) and flat fields (legacy SRD JSON).
  const skillsDesc = findBenefit(input.benefits, (b) => /skill proficiencies?/i.test(b.name ?? ""))
    ?? input.skill_proficiencies ?? undefined;
  const toolsDesc = findBenefit(input.benefits, (b) => /tool proficiencies?/i.test(b.name ?? ""))
    ?? input.tool_proficiencies ?? undefined;
  const langDesc = findBenefit(input.benefits, (b) => /languages?/i.test(b.name ?? ""))
    ?? input.languages ?? undefined;
  const equipDesc = findBenefit(input.benefits, (b) => /equipment/i.test(b.name ?? ""))
    ?? input.equipment ?? undefined;
  const featureEntry = input.benefits?.find((b) => /feature/i.test(b.type ?? b.name ?? ""));
  const featureName = (featureEntry?.name ?? input.feature ?? "Background Feature")
    .replace(/^\s*feature:\s*/i, "")
    .trim() || "Background Feature";
  // Schema requires a non-empty description. Fall back to a placeholder that
  // signals missing data rather than silently failing validation.
  const featureDesc = (featureEntry?.desc ?? input.feature_desc ?? "").trim()
    || "(No description provided.)";

  const data: BackgroundEntity = {
    slug: input.slug,
    name: input.name,
    edition,
    source: "SRD 5.1",
    description: input.desc ?? "",
    skill_proficiencies: parseSkillProfs(skillsDesc),
    tool_proficiencies: parseToolProfs(toolsDesc),
    language_proficiencies: parseLanguages(langDesc),
    equipment: parseEquipment(equipDesc),
    feature: {
      name: featureName,
      description: featureDesc,
    },
    ability_score_increases: null,
    origin_feat: null,
    suggested_characteristics: null,
    variants: [],
  };

  return {
    frontmatter: {
      archivist: true,
      entity_type: "background",
      slug: data.slug,
      name: data.name,
      compendium,
      source: data.source,
    },
    data,
  };
}
