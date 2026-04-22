import type { ClassEntity, ClassTableRow, StartingEquipmentEntry, Edition } from "./class.types";
import type { Feature, SkillSlug, Ability } from "../../shared/types";

export interface Open5eClassJson {
  name: string;
  slug: string;
  desc?: string;
  hit_dice?: string;
  prof_armor?: string;
  prof_weapons?: string;
  prof_tools?: string;
  prof_saving_throws?: string;
  prof_skills?: string;
  equipment?: string;
  table?: string;
  spellcasting_ability?: string;
  subtypes_name?: string;
  archetypes?: Array<Record<string, unknown>>;
  document__slug?: string;
}

const SKILL_NAME_TO_SLUG: Record<string, SkillSlug> = {
  "acrobatics": "acrobatics",
  "animal handling": "animal-handling",
  "arcana": "arcana",
  "athletics": "athletics",
  "deception": "deception",
  "history": "history",
  "insight": "insight",
  "intimidation": "intimidation",
  "investigation": "investigation",
  "medicine": "medicine",
  "nature": "nature",
  "perception": "perception",
  "performance": "performance",
  "persuasion": "persuasion",
  "religion": "religion",
  "sleight of hand": "sleight-of-hand",
  "stealth": "stealth",
  "survival": "survival",
};

const ABILITY_NAME_TO_SLUG: Record<string, Ability> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

function normalizeHitDie(dice: string | undefined): "d6" | "d8" | "d10" | "d12" {
  const match = /d(6|8|10|12)/i.exec(dice ?? "");
  if (!match) throw new Error(`unrecognized hit_dice: ${dice}`);
  return `d${match[1]}` as "d6" | "d8" | "d10" | "d12";
}

function parseSavingThrows(raw: string | undefined): Ability[] {
  if (!raw) return [];
  return raw.split(",")
    .map((s) => ABILITY_NAME_TO_SLUG[s.trim().toLowerCase()])
    .filter((s): s is Ability => s !== undefined);
}

function parseSkillChoices(raw: string | undefined): { count: number; from: SkillSlug[] } {
  if (!raw) return { count: 0, from: [] };
  const countMatch = /choose\s+(\w+)/i.exec(raw);
  const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
  const countWord = countMatch?.[1]?.toLowerCase();
  const count = countWord ? wordToNum[countWord] ?? Number(countWord) : 0;
  const from: SkillSlug[] = [];
  for (const [name, slug] of Object.entries(SKILL_NAME_TO_SLUG)) {
    if (raw.toLowerCase().includes(name)) from.push(slug);
  }
  return { count, from };
}

function parseArmorProfs(raw: string | undefined): Array<"light" | "medium" | "heavy" | "shield"> {
  if (!raw) return [];
  const out: Array<"light" | "medium" | "heavy" | "shield"> = [];
  const lc = raw.toLowerCase();
  if (lc.includes("light")) out.push("light");
  if (lc.includes("medium")) out.push("medium");
  if (lc.includes("heavy")) out.push("heavy");
  if (lc.includes("shield")) out.push("shield");
  return out;
}

function parseWeaponProfs(raw: string | undefined): ClassEntity["proficiencies"]["weapons"] {
  if (!raw) return { fixed: [] };
  const parts = raw.split(",").map((s) => s.trim().toLowerCase());
  const categories: Array<"simple" | "martial"> = [];
  const fixed: string[] = [];
  for (const p of parts) {
    if (p === "simple weapons") categories.push("simple");
    else if (p === "martial weapons") categories.push("martial");
    else if (p.length > 0) fixed.push(p.replace(/\s+/g, "-"));
  }
  const result: ClassEntity["proficiencies"]["weapons"] = {};
  if (categories.length > 0) result.categories = categories;
  if (fixed.length > 0) result.fixed = fixed;
  return result;
}

function parseToolProfs(raw: string | undefined): ClassEntity["proficiencies"]["tools"] {
  if (!raw || raw.trim().length === 0) return undefined;
  const parts = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    .map((s) => s.toLowerCase().replace(/\s+/g, "-").replace(/'/g, ""));
  return { fixed: parts };
}

function parseEquipment(raw: string | undefined): StartingEquipmentEntry[] {
  if (!raw) return [];
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("*"));
  if (lines.length === 0) return [];
  return [{ kind: "fixed", items: lines.map((l) => l.replace(/^\*\s*/, "")) }];
}

function parseTable(raw: string | undefined): Record<number, ClassTableRow> {
  const rows: Record<number, ClassTableRow> = {};
  if (!raw) return rows;
  const lines = raw.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim())
      .filter((c, i, arr) => i !== 0 && i !== arr.length - 1);
    if (cells.length < 2) continue;
    const levelMatch = /^(\d+)/.exec(cells[0]);
    if (!levelMatch) continue;
    const level = Number(levelMatch[1]);
    const profMatch = /([+-]?\d+)/.exec(cells[1]);
    const prof_bonus = profMatch ? Number(profMatch[1]) : 2;
    const featuresCell = cells[cells.length - 1];
    const feature_ids = featuresCell.split(",")
      .map((f) => f.trim().toLowerCase().replace(/\s+/g, "-").replace(/'/g, ""))
      .filter((f) => f.length > 0);
    const columns: Record<string, string | number> = {};
    for (let i = 2; i < cells.length - 1; i++) columns[`col${i - 1}`] = cells[i];
    rows[level] = { prof_bonus, feature_ids, columns: Object.keys(columns).length > 0 ? columns : undefined };
  }
  return rows;
}

function parseFeaturesFromDesc(desc: string | undefined): Record<number, Feature[]> {
  const features: Record<number, Feature[]> = {};
  if (!desc) return features;
  const sections = desc.split(/\n(?=###\s)/);
  for (const section of sections) {
    const headerMatch = /^###\s+(.+?)\s*\n/.exec(section);
    if (!headerMatch) continue;
    const name = headerMatch[1].trim();
    const body = section.substring(headerMatch[0].length).trim();
    const levelMatch = /(?:at|beginning at|starting at|by)\s+(\d+)(?:st|nd|rd|th)\s+level/i.exec(body);
    const level = levelMatch ? Number(levelMatch[1]) : 1;
    const feature: Feature = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name,
      description: body,
    };
    features[level] ??= [];
    features[level].push(feature);
  }
  return features;
}

function slugifyParentClassName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface NormalizedEntity<T = unknown> {
  frontmatter: {
    archivist: true;
    entity_type: string;
    slug: string;
    name: string;
    compendium: string;
    source: string;
  };
  data: T;
}

export function normalizeSrdClass(
  input: Open5eClassJson,
  opts: { edition?: Edition; compendium?: string } = {},
): NormalizedEntity<ClassEntity> {
  const edition = opts.edition ?? "2014";
  const compendium = opts.compendium ?? "SRD";

  const data: ClassEntity = {
    slug: input.slug,
    name: input.name,
    edition,
    source: "SRD 5.1",
    description: input.desc ?? "",
    hit_die: normalizeHitDie(input.hit_dice),
    primary_abilities: [],
    saving_throws: parseSavingThrows(input.prof_saving_throws),
    proficiencies: {
      armor: parseArmorProfs(input.prof_armor),
      weapons: parseWeaponProfs(input.prof_weapons),
      tools: parseToolProfs(input.prof_tools),
    },
    skill_choices: parseSkillChoices(input.prof_skills),
    starting_equipment: parseEquipment(input.equipment),
    spellcasting: null,
    subclass_level: 3,
    subclass_feature_name: input.subtypes_name ?? "Subclass",
    weapon_mastery: null,
    epic_boon_level: null,
    table: parseTable(input.table),
    features_by_level: parseFeaturesFromDesc(input.desc),
    resources: [],
  };

  return {
    frontmatter: {
      archivist: true,
      entity_type: "class",
      slug: data.slug,
      name: data.name,
      compendium,
      source: data.source,
    },
    data,
  };
}

export function classSlugify(name: string): string {
  return slugifyParentClassName(name);
}
