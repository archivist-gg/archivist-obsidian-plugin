import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";

/**
 * ClassCanonical mirrors the runtime ClassEntity shape (src/modules/class/class.schema.ts)
 * so the emitted YAML in `.compendium-bundle/SRD 5e/Classes/*.md` parses through
 * `parseClass` without a translation layer.
 */
export interface ClassCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  hit_die: "d6" | "d8" | "d10" | "d12";
  primary_abilities: Ability[];
  saving_throws: Ability[];
  proficiencies: ClassProficiencies;
  skill_choices: { count: number; from: SkillSlug[] };
  starting_equipment: StartingEquipmentEntry[];
  spellcasting: SpellcastingConfig | null;
  subclass_level: number;
  subclass_feature_name: string;
  weapon_mastery: WeaponMasteryConfig | null;
  epic_boon_level: number | null;
  table: Record<string, ClassTableRow>;
  features_by_level: Record<string, ClassFeatureOut[]>;
  resources: ResourceOut[];
}

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type SkillSlug =
  | "acrobatics" | "animal-handling" | "arcana" | "athletics" | "deception"
  | "history" | "insight" | "intimidation" | "investigation" | "medicine"
  | "nature" | "perception" | "performance" | "persuasion" | "religion"
  | "sleight-of-hand" | "stealth" | "survival";
type ArmorCategory = "light" | "medium" | "heavy" | "shield";
type WeaponCategory = "simple" | "martial";

interface ClassProficiencies {
  armor: ArmorCategory[];
  weapons: { fixed?: string[]; categories?: WeaponCategory[] };
  tools?: { fixed: string[] };
}

type StartingEquipmentEntry =
  | { kind: "fixed"; items: string[] }
  | { kind: "choice"; options: string[] }
  | { kind: "gold"; amount: number };

interface SpellcastingConfig {
  ability: Ability;
  preparation: "known" | "prepared" | "ritual" | "spontaneous";
  cantrip_progression?: Record<string, number>;
  spells_known_formula?: string;
  spell_list: string;
}

interface WeaponMasteryConfig {
  starting_count: number;
  scaling?: Record<string, number>;
}

interface ClassTableRow {
  prof_bonus: number;
  columns?: Record<string, string | number>;
  feature_ids: string[];
}

/**
 * Class feature emitted into features_by_level. Carries the standard
 * Feature shape (id/name/description) plus optional overlay fields.
 */
export interface ClassFeatureOut {
  id?: string;
  name: string;
  description: string;
  action?: "action" | "bonus-action" | "reaction" | "free" | "special";
  /** Overlay-supplied uses block. */
  uses?: {
    max: number | string;
    recharge?: string;
    scales_at?: Array<{ level: number; value?: number | string; max?: number | string }>;
  };
  scales_at?: Array<{ level: number; damage?: { dice: string }; max?: number | string }>;
}

interface ResourceOut {
  id: string;
  name: string;
  max_formula: string;
  reset: "short-rest" | "long-rest" | "dawn" | "dusk" | "turn" | "round" | "custom";
}

export const classMergeRule: MergeRule = {
  kind: "class",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // Class overlay is keyed by feature-slug, not class-slug. Pass the full class_features map;
    // toClassCanonical handles per-feature lookup.
    return overlay.class_features ?? null;
  },
};

// ---------------------------------------------------------------------------
// Open5e v2 class shape (subset we read).
// ---------------------------------------------------------------------------

interface Open5eClassFeature {
  key: string;
  name: string;
  desc: string;
  /**
   * Open5e enum values include CLASS_LEVEL_FEATURE, CORE_TRAITS_TABLE,
   * CLASS_TABLE_DATA, PROFICIENCY_BONUS, SPELL_SLOTS, STARTING_EQUIPMENT,
   * PROFICIENCIES. We type this as a plain string so future Open5e additions
   * don't break compilation; the merger checks specific values explicitly.
   */
  feature_type: string;
  gained_at: Array<{ level: number; detail: string | null }>;
  data_for_class_table: Array<{ level: number; column_value: string }>;
}

interface Open5eClassBase {
  key: string;
  name: string;
  desc?: string;
  hit_dice?: string;
  subclass_of?: { key: string; name: string } | null;
  caster_type?: string | null;
  primary_abilities?: string[];
  saving_throws?: Array<{ name: string }>;
  features?: Open5eClassFeature[];
  hit_points?: { hit_dice?: string };
}

// ---------------------------------------------------------------------------
// Lookup tables (mirror src/modules/class/class.normalizer.ts).
// ---------------------------------------------------------------------------

const ABILITY_NAME_TO_SLUG: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
  str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha",
};

const PRIMARY_ABILITIES_BY_SLUG: Record<string, Ability[]> = {
  barbarian: ["str"],
  bard: ["cha"],
  cleric: ["wis"],
  druid: ["wis"],
  fighter: ["str", "dex"],
  monk: ["dex", "wis"],
  paladin: ["str", "cha"],
  ranger: ["dex", "wis"],
  rogue: ["dex"],
  sorcerer: ["cha"],
  warlock: ["cha"],
  wizard: ["int"],
  artificer: ["int"],
};

const ALL_SKILL_SLUGS: SkillSlug[] = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight-of-hand", "stealth", "survival",
];

const SPELLCASTING_ABILITY_BY_SLUG: Record<string, Ability> = {
  bard: "cha",
  cleric: "wis",
  druid: "wis",
  paladin: "cha",
  ranger: "wis",
  sorcerer: "cha",
  warlock: "cha",
  wizard: "int",
  artificer: "int",
};

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function normalizeHitDie(raw: string | undefined | null): "d6" | "d8" | "d10" | "d12" {
  const m = /d(6|8|10|12)/i.exec(raw ?? "");
  if (!m) {
    // Schema requires one of the four; default to d8 for unknown shapes so we
    // don't crash structural validation on malformed sources.
    return "d8";
  }
  return `d${m[1]}` as "d6" | "d8" | "d10" | "d12";
}

function parseSavingThrows(raw: Array<{ name: string }> | undefined): Ability[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ABILITY_NAME_TO_SLUG[s.name?.toLowerCase?.() ?? ""])
    .filter((a): a is Ability => a !== undefined);
}

function deriveClassNameSlug(canonicalSlug: string, name: string): string {
  // canonicalSlug is `srd-5e_<slugifiedname>`; strip the prefix when present.
  const idx = canonicalSlug.indexOf("_");
  if (idx >= 0) return canonicalSlug.slice(idx + 1).toLowerCase();
  return slugifyName(name);
}

function resolvePrimaryAbilities(canonicalSlug: string, name: string, savingThrows: Ability[]): Ability[] {
  const nameSlug = deriveClassNameSlug(canonicalSlug, name);
  const byLookup = PRIMARY_ABILITIES_BY_SLUG[nameSlug];
  if (byLookup && byLookup.length > 0) return byLookup;
  if (savingThrows.length > 0) return [savingThrows[0]];
  return ["str"];
}

function clampSavingThrows(saves: Ability[]): Ability[] {
  // Schema requires exactly two. If we have more or fewer, pad/trim with safe
  // defaults so structural validation passes.
  if (saves.length === 2) return saves;
  if (saves.length > 2) return saves.slice(0, 2);
  const padded = [...saves];
  const fallback: Ability[] = ["str", "con", "dex", "wis", "int", "cha"];
  for (const a of fallback) {
    if (padded.length >= 2) break;
    if (!padded.includes(a)) padded.push(a);
  }
  return padded.slice(0, 2);
}

function parseProficienciesProse(features: Open5eClassFeature[]): {
  proficiencies: ClassProficiencies;
  skill_choices: { count: number; from: SkillSlug[] };
} {
  const profFeature = features.find((f) => f.feature_type === "PROFICIENCIES");
  const desc = profFeature?.desc ?? "";

  const fieldRegex = (label: string) =>
    new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n\\r]+)`, "i");
  const grab = (label: string): string => {
    const m = fieldRegex(label).exec(desc);
    return m ? m[1].trim() : "";
  };

  const armorRaw = grab("Armor").toLowerCase();
  const weaponsRaw = grab("Weapons").toLowerCase();
  const toolsRaw = grab("Tools");
  const skillsRaw = grab("Skills");

  const armor: ArmorCategory[] = [];
  if (armorRaw.includes("light")) armor.push("light");
  if (armorRaw.includes("medium")) armor.push("medium");
  if (armorRaw.includes("heavy")) armor.push("heavy");
  if (armorRaw.includes("shield")) armor.push("shield");
  // "All armor" → light+medium+heavy.
  if (armorRaw.includes("all armor") && !armor.includes("light")) {
    armor.push("light", "medium", "heavy");
  }

  const weapons: ClassProficiencies["weapons"] = {};
  const wparts = weaponsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const wcategories: WeaponCategory[] = [];
  const wfixed: string[] = [];
  for (const p of wparts) {
    if (p === "simple weapons" || p === "simple") wcategories.push("simple");
    else if (p === "martial weapons" || p === "martial") wcategories.push("martial");
    else if (p && p !== "none") wfixed.push(p);
  }
  if (wcategories.length > 0) weapons.categories = wcategories;
  if (wfixed.length > 0) weapons.fixed = wfixed;
  // Schema refines that weapons must declare at least one of fixed/categories/conditional.
  if (!weapons.categories && !weapons.fixed) {
    weapons.fixed = ["unarmed"];
  }

  const result: ClassProficiencies = { armor, weapons };
  const toolsClean = toolsRaw.replace(/none\.?$/i, "").trim();
  if (toolsClean.length > 0) {
    const fixed = toolsClean
      .split(",")
      .map((s) => s.trim().replace(/\.$/, ""))
      .filter(Boolean);
    if (fixed.length > 0) result.tools = { fixed };
  }

  const skill_choices = parseSkillChoices(skillsRaw);

  return { proficiencies: result, skill_choices };
}

function parseSkillChoices(raw: string): { count: number; from: SkillSlug[] } {
  const fallback = { count: 2, from: ALL_SKILL_SLUGS };
  if (!raw) return fallback;
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  };
  const m = /choose\s+(?:any\s+)?(\w+)/i.exec(raw);
  let count = 0;
  if (m) {
    const w = m[1].toLowerCase();
    const fromWord = wordToNum[w];
    const fromDigit = Number.parseInt(w, 10);
    count = fromWord ?? (Number.isFinite(fromDigit) ? fromDigit : 0);
  }

  const SKILL_LOOKUP: Record<string, SkillSlug> = {
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
  const lower = raw.toLowerCase();
  const from: SkillSlug[] = [];
  for (const [name, slug] of Object.entries(SKILL_LOOKUP)) {
    if (lower.includes(name)) from.push(slug);
  }
  if (from.length === 0) return { count: count > 0 ? count : 2, from: ALL_SKILL_SLUGS };
  return { count: count > 0 ? count : 2, from };
}

function parseStartingEquipment(features: Open5eClassFeature[]): StartingEquipmentEntry[] {
  const eq = features.find((f) => f.feature_type === "STARTING_EQUIPMENT");
  if (!eq?.desc) return [];
  const items: string[] = [];
  for (const line of eq.desc.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("*")) continue;
    const cleaned = trimmed.replace(/^\*\s*/, "").trim();
    if (cleaned.length > 0) items.push(cleaned);
  }
  if (items.length === 0) return [];
  return [{ kind: "fixed", items }];
}

function bucketFeaturesByLevel(
  features: Open5eClassFeature[],
  edition: "2014" | "2024",
  overlay: Record<string, ClassFeatureOut> | null,
): { features_by_level: Record<string, ClassFeatureOut[]>; idsByLevel: Map<number, string[]> } {
  const out: Record<string, ClassFeatureOut[]> = {};
  const idsByLevel = new Map<number, string[]>();

  const KEEP_TYPES = new Set(["CLASS_LEVEL_FEATURE", "CORE_TRAITS_TABLE"]);
  for (const f of features) {
    if (!KEEP_TYPES.has(f.feature_type)) continue;
    const featureSlug = slugifyName(f.name);
    const overlaid = overlay?.[featureSlug];
    const description = rewriteCrossRefs(f.desc ?? "", edition);
    const desc = description && description.length > 0 ? description : f.name;
    const levels = (f.gained_at ?? []).map((g) => g.level).filter((n) => Number.isFinite(n));
    const seen = new Set<number>();
    for (const lvl of levels) {
      if (seen.has(lvl)) continue;
      seen.add(lvl);
      const feature: ClassFeatureOut = {
        id: featureSlug,
        name: f.name,
        description: desc,
        ...(overlaid?.action ? { action: overlaid.action } : {}),
        ...(overlaid?.uses ? { uses: overlaid.uses } : {}),
        ...(overlaid?.scales_at ? { scales_at: overlaid.scales_at } : {}),
      };
      const key = String(lvl);
      out[key] ??= [];
      out[key].push(feature);
      const ids = idsByLevel.get(lvl) ?? [];
      ids.push(featureSlug);
      idsByLevel.set(lvl, ids);
    }
  }

  return { features_by_level: out, idsByLevel };
}

function buildTable(
  features: Open5eClassFeature[],
  idsByLevel: Map<number, string[]>,
): Record<string, ClassTableRow> {
  // Collect unique levels referenced by feature gains and column data.
  const levels = new Set<number>();
  for (const lvl of idsByLevel.keys()) levels.add(lvl);

  // Find the dedicated proficiency-bonus column (when present) and any
  // additional class-table columns.
  const profFeature = features.find((f) => f.feature_type === "PROFICIENCY_BONUS");
  const columnFeatures = features.filter(
    (f) => Array.isArray(f.data_for_class_table) && f.data_for_class_table.length > 0
      && f.feature_type !== "PROFICIENCY_BONUS",
  );

  for (const cf of columnFeatures) {
    for (const row of cf.data_for_class_table) {
      if (Number.isFinite(row.level)) levels.add(row.level);
    }
  }
  if (profFeature) {
    for (const row of profFeature.data_for_class_table ?? []) {
      if (Number.isFinite(row.level)) levels.add(row.level);
    }
  }

  // Default progression — kept tight so we always emit a valid prof_bonus
  // when Open5e omits the PROFICIENCY_BONUS feature.
  const defaultProf = (lvl: number): number => {
    if (lvl <= 4) return 2;
    if (lvl <= 8) return 3;
    if (lvl <= 12) return 4;
    if (lvl <= 16) return 5;
    return 6;
  };

  // Index proficiency-bonus values by level.
  const profByLevel = new Map<number, number>();
  if (profFeature) {
    for (const row of profFeature.data_for_class_table ?? []) {
      const m = /([+-]?\d+)/.exec(row.column_value ?? "");
      if (m) profByLevel.set(row.level, Number(m[1]));
    }
  }

  const result: Record<string, ClassTableRow> = {};
  const sortedLevels = [...levels].sort((a, b) => a - b);
  if (sortedLevels.length === 0) {
    // Always at least produce level 1 so the schema has a non-empty record.
    sortedLevels.push(1);
  }
  for (const lvl of sortedLevels) {
    const prof_bonus = profByLevel.get(lvl) ?? defaultProf(lvl);
    const columns: Record<string, string | number> = {};
    for (const cf of columnFeatures) {
      const cell = cf.data_for_class_table.find((r) => r.level === lvl);
      if (cell) columns[cf.name] = cell.column_value;
    }
    const feature_ids = idsByLevel.get(lvl) ?? [];
    const row: ClassTableRow = {
      prof_bonus: Math.max(1, prof_bonus),
      feature_ids,
    };
    if (Object.keys(columns).length > 0) row.columns = columns;
    result[String(lvl)] = row;
  }

  return result;
}

function buildSpellcasting(
  base: Open5eClassBase,
  canonicalSlug: string,
  structured: Record<string, unknown> | null,
): SpellcastingConfig | null {
  const nameSlug = deriveClassNameSlug(canonicalSlug, base.name);
  const ability = SPELLCASTING_ABILITY_BY_SLUG[nameSlug];
  const casterType = (base.caster_type ?? "").toUpperCase();
  const isCaster = ability !== undefined && casterType !== "" && casterType !== "NONE";

  // Prefer structured-rules data when present.
  if (structured && typeof (structured as { spellcasting?: unknown }).spellcasting === "object") {
    const sc = (structured as { spellcasting: { ability?: string; preparation?: string; spell_list?: string } }).spellcasting;
    const rawAbility = sc.ability?.toLowerCase?.();
    const resolvedAbility = (rawAbility && ABILITY_NAME_TO_SLUG[rawAbility]) || ability;
    if (resolvedAbility) {
      return {
        ability: resolvedAbility,
        preparation: (sc.preparation as SpellcastingConfig["preparation"]) ?? "prepared",
        spell_list: sc.spell_list ?? base.name,
      };
    }
  }

  if (!isCaster || !ability) return null;
  // Best-effort defaults — a richer pass lives in a future task.
  const preparation: SpellcastingConfig["preparation"] = nameSlug === "wizard"
    ? "prepared"
    : "known";
  return { ability, preparation, spell_list: base.name };
}

function buildResources(structured: Record<string, unknown> | null): ResourceOut[] {
  if (!structured || !Array.isArray((structured as { resources?: unknown }).resources)) return [];
  const raw = (structured as { resources: Array<Record<string, unknown>> }).resources;
  const out: ResourceOut[] = [];
  for (const r of raw) {
    const id = (r.id as string) ?? (typeof r.name === "string" ? slugifyName(r.name) : null);
    const name = r.name as string | undefined;
    const max_formula = r.max_formula as string | undefined;
    const reset = r.reset as ResourceOut["reset"] | undefined;
    if (!id || !name || !max_formula || !reset) continue;
    out.push({ id, name, max_formula, reset });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export function toClassCanonical(entry: CanonicalEntry): ClassCanonical {
  const base = entry.base as unknown as Open5eClassBase;
  const structured = entry.structured as Record<string, unknown> | null;
  const overlay = entry.overlay as Record<string, ClassFeatureOut> | null;

  const features = base.features ?? [];

  const hit_die = normalizeHitDie(base.hit_dice ?? base.hit_points?.hit_dice);
  const savingsParsed = parseSavingThrows(base.saving_throws);
  const saving_throws = clampSavingThrows(savingsParsed);
  const primary_abilities = resolvePrimaryAbilities(entry.slug, base.name, saving_throws);

  const { proficiencies, skill_choices } = parseProficienciesProse(features);
  const starting_equipment = parseStartingEquipment(features);
  const { features_by_level, idsByLevel } = bucketFeaturesByLevel(features, entry.edition, overlay);
  const table = buildTable(features, idsByLevel);

  const out: ClassCanonical = {
    slug: entry.slug,
    name: base.name,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs(base.desc ?? "", entry.edition),
    hit_die,
    primary_abilities,
    saving_throws,
    proficiencies,
    skill_choices,
    starting_equipment,
    spellcasting: buildSpellcasting(base, entry.slug, structured),
    subclass_level: 3,
    subclass_feature_name: "Subclass",
    weapon_mastery: null,
    epic_boon_level: null,
    table,
    features_by_level,
    resources: buildResources(structured),
  };

  return out;
}
