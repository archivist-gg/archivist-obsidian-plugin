import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";
import { slugifyName } from "../sources/slug-normalize";
import type { Resource } from "../../../src/shared/types/resource";
import type { Choice } from "../../../src/shared/types/choice";
import type { StartingEquipmentEntry } from "../../../src/shared/types/equipment-grant";
import { bareSlug } from "./class-merge";

type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
type SkillSlug =
  | "acrobatics" | "animal-handling" | "arcana" | "athletics" | "deception"
  | "history" | "insight" | "intimidation" | "investigation" | "medicine"
  | "nature" | "perception" | "performance" | "persuasion" | "religion"
  | "sleight-of-hand" | "stealth" | "survival";

type ToolProf =
  | { kind: "fixed"; items: string[] }
  | { kind: "choice"; count: number; from: string[] };

type LangProf =
  | { kind: "fixed"; languages: string[] }
  | { kind: "choice"; count: number; from: string | string[] };

interface SuggestedCharacteristics {
  personality_traits?: Record<string, string>;
  ideals?: Record<string, { name?: string; desc: string; alignment?: string }>;
  bonds?: Record<string, string>;
  flaws?: Record<string, string>;
}

export interface BackgroundCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  description: string;
  skill_proficiencies: SkillSlug[];
  tool_proficiencies: ToolProf[];
  language_proficiencies: LangProf[];
  equipment: StartingEquipmentEntry[];
  feature: { name: string; description: string; resources?: Resource[]; choices?: Choice[] };
  ability_score_increases: { pool: Ability[] } | null;
  origin_feat: string | null;
  suggested_characteristics: SuggestedCharacteristics | null;
  choices?: Choice[];
}

interface Open5eBenefit {
  name?: string;
  desc: string;
  type?: string;
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

const ABILITY_NAME_TO_KEY: Record<string, Ability> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
  str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha",
};

export const backgroundMergeRule: MergeRule = {
  kind: "background",
  pickOverlay(overlay: Overlay, _slug: string): unknown {
    // background_features carries per-background feature overrides (resources,
    // choices) keyed by background-slug; backgrounds carries entity-level
    // overrides (choices) keyed by bare background-slug.
    return { background_features: overlay.background_features ?? null, backgrounds: overlay.backgrounds ?? null };
  },
};

export function toBackgroundCanonical(entry: CanonicalEntry): BackgroundCanonical {
  const base = entry.base as Record<string, unknown>;
  const compendium = entry.edition === "2014" ? "SRD 5e" : "SRD 2024";
  // pickOverlay now returns { background_features, backgrounds }; unpack both.
  const ov = entry.overlay as {
    background_features: Record<string, { resources?: Resource[]; choices?: Choice[] }> | null;
    backgrounds: Record<string, { choices?: Choice[]; equipment?: StartingEquipmentEntry[] }> | null;
  } | null;
  const overlaid = ov?.background_features?.[slugifyName(base.name as string)];
  const bgOverride = ov?.backgrounds?.[bareSlug(entry.slug)];

  const benefits = ((base.benefits as Open5eBenefit[] | undefined) ?? []);

  let skillProfs: SkillSlug[] = [];
  const toolProfs: ToolProf[] = [];
  const langProfs: LangProf[] = [];
  let equipment: StartingEquipmentEntry[] = [];
  let feature: { name: string; description: string; resources?: Resource[]; choices?: Choice[] } = { name: "", description: "" };
  let suggestedCharacteristics: SuggestedCharacteristics | null = null;
  let asi: { pool: Ability[] } | null = null;
  let originFeat: string | null = null;

  for (const b of benefits) {
    switch (b.type) {
      case "skill_proficiency": {
        const skills = parseSkillSlugs(b.desc);
        skillProfs = dedupe([...skillProfs, ...skills]);
        break;
      }
      case "tool_proficiency": {
        const tp = parseToolProf(b.desc);
        if (tp) toolProfs.push(tp);
        break;
      }
      case "language": {
        const lp = parseLangProf(b.desc);
        if (lp) langProfs.push(lp);
        break;
      }
      case "equipment": {
        equipment = parseEquipment(b.desc);
        break;
      }
      case "feature": {
        feature = {
          name: (b.name ?? "").trim() || "Background Feature",
          description: rewriteCrossRefs((b.desc ?? "").trim(), entry.edition) || "(No description provided.)",
        };
        break;
      }
      case "suggested_characteristics": {
        // Preserve prose in a single-bucket object so the schema still validates.
        // Structured parsing of the d8/d6 tables is deferred (see plan W2).
        if ((b.desc ?? "").trim().length > 0) {
          suggestedCharacteristics = {
            personality_traits: { _open5e_prose: b.desc },
          };
        }
        break;
      }
      case "ability_score": {
        const pool = parseAbilityPool(b.desc);
        if (pool.length === 3) asi = { pool };
        break;
      }
      case "feat": {
        const featName = (b.desc ?? "").trim();
        if (featName) {
          originFeat = `[[${compendium}/Feats/${featName}]]`;
        }
        break;
      }
      default:
        // Unknown benefit type — skip silently.
        break;
    }
  }

  // Schema requires non-empty feature name + description. Apply placeholders
  // when benefits[] is missing the feature entry rather than silently failing
  // schema validation downstream.
  if (!feature.name) feature = { name: "Background Feature", description: feature.description };
  if (!feature.description) feature = { ...feature, description: "(No description provided.)" };
  if (overlaid?.resources) feature = { ...feature, resources: overlaid.resources };
  if (overlaid?.choices) feature = { ...feature, choices: overlaid.choices };

  const out: BackgroundCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    skill_proficiencies: skillProfs,
    tool_proficiencies: toolProfs,
    language_proficiencies: langProfs,
    equipment,
    feature,
    ability_score_increases: asi,
    origin_feat: originFeat,
    suggested_characteristics: suggestedCharacteristics,
    ...(bgOverride?.choices ? { choices: bgOverride.choices } : {}),
  };

  // Entity-level overlay equipment (structured grants) takes precedence over the
  // prose-derived display fallback, mirroring class-merge's starting_equipment.
  if (bgOverride?.equipment) out.equipment = bgOverride.equipment;

  return out;
}

function parseSkillSlugs(desc: string): SkillSlug[] {
  if (!desc) return [];
  const lc = desc.toLowerCase();
  const out: SkillSlug[] = [];
  for (const [name, slug] of Object.entries(SKILL_NAME_TO_SLUG)) {
    // word-boundary match so "history" doesn't collide with longer names.
    const re = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`);
    if (re.test(lc)) out.push(slug);
  }
  return dedupe(out);
}

function parseToolProf(desc: string): ToolProf | null {
  if (!desc) return null;
  const items = splitFreeText(desc).map(s => s.toLowerCase().replace(/\s+/g, "-"));
  if (items.length === 0) return null;
  return { kind: "fixed", items };
}

function parseLangProf(desc: string): LangProf | null {
  if (!desc) return null;
  // Detect "X of your choice" — choice form.
  const wordToNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const choiceMatch = /^\s*(\w+)\s+of\s+your\s+choice/i.exec(desc);
  if (choiceMatch) {
    const tok = choiceMatch[1].toLowerCase();
    const n = wordToNum[tok] ?? Number(tok);
    return { kind: "choice", count: Number.isFinite(n) && n > 0 ? n : 1, from: "any" };
  }
  // Otherwise, treat as fixed list (split on commas / "and").
  const items = splitFreeText(desc);
  if (items.length === 0) return null;
  return { kind: "fixed", languages: items };
}

function parseEquipment(desc: string): StartingEquipmentEntry[] {
  if (!desc) return [];
  // Prose fallback: preserve the original benefit text for DISPLAY only
  // (grants empty → seeds nothing). The authored overlay `backgrounds:`
  // equipment overrides this with structured grants; only un-annotated
  // backgrounds fall here. Mirrors class-merge's parseStartingEquipment.
  const label = desc.trim();
  if (!label) return [];
  return [{ kind: "fixed", label, grants: [] }];
}

function parseAbilityPool(desc: string): Ability[] {
  if (!desc) return [];
  const out: Ability[] = [];
  for (const tok of splitFreeText(desc)) {
    const key = ABILITY_NAME_TO_KEY[tok.toLowerCase()];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function splitFreeText(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/,\s*|\s+and\s+/i)
    .map(t => t.trim())
    .filter(Boolean);
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
