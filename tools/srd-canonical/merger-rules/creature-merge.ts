import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface CreatureAction {
  name: string;
  desc: string;
}

export interface CreatureCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  size: string;
  type: string;
  description?: string;
  ac: number | string;
  hp: { average: number; formula?: string };
  speed: Record<string, number>;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  cr?: string;
  saving_throws?: Record<string, number>;
  skills?: Record<string, number>;
  senses?: string;
  languages?: string;
  actions?: CreatureAction[];
  legendary_actions?: CreatureAction[];
  reactions?: CreatureAction[];
  traits?: CreatureAction[];
}

export const creatureMergeRule: MergeRule = {
  kind: "creature",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Creatures are well-structured in Open5e; no overlay applies here.
    return null;
  },
};

export function toCreatureCanonical(entry: CanonicalEntry): CreatureCanonical {
  const base = entry.base as Record<string, unknown>;

  const out: CreatureCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    size: (base.size as string | undefined) ?? "",
    type: (base.type as string | undefined) ?? "",
    ac: (base.ac as number | string | undefined) ?? 0,
    hp: normalizeHp(base.hp),
    speed: (base.speed as Record<string, number> | undefined) ?? {},
    abilities: normalizeAbilities(base.abilities),
  };

  if (typeof base.desc === "string" && base.desc.length > 0) {
    out.description = rewriteCrossRefs(base.desc, entry.edition);
  }
  if (typeof base.cr === "string" || typeof base.cr === "number") {
    out.cr = String(base.cr);
  }
  if (base.saving_throws && typeof base.saving_throws === "object") {
    out.saving_throws = base.saving_throws as Record<string, number>;
  }
  if (base.skills && typeof base.skills === "object") {
    out.skills = base.skills as Record<string, number>;
  }
  if (typeof base.senses === "string") out.senses = base.senses;
  if (typeof base.languages === "string") out.languages = base.languages;
  if (Array.isArray(base.actions)) out.actions = mapActions(base.actions, entry.edition);
  if (Array.isArray(base.legendary_actions)) out.legendary_actions = mapActions(base.legendary_actions, entry.edition);
  if (Array.isArray(base.reactions)) out.reactions = mapActions(base.reactions, entry.edition);
  if (Array.isArray(base.traits)) out.traits = mapActions(base.traits, entry.edition);

  return out;
}

function normalizeHp(raw: unknown): CreatureCanonical["hp"] {
  if (raw && typeof raw === "object") {
    const obj = raw as { average?: number; formula?: string };
    return {
      average: typeof obj.average === "number" ? obj.average : 0,
      ...(typeof obj.formula === "string" ? { formula: obj.formula } : {}),
    };
  }
  if (typeof raw === "number") return { average: raw };
  return { average: 0 };
}

function normalizeAbilities(raw: unknown): CreatureCanonical["abilities"] {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (k: string): number => (typeof r[k] === "number" ? r[k] : 10);
  return {
    str: num("str"), dex: num("dex"), con: num("con"),
    int: num("int"), wis: num("wis"), cha: num("cha"),
  };
}

function mapActions(arr: unknown[], edition: "2014" | "2024"): CreatureAction[] {
  return arr.map(a => {
    const obj = (a ?? {}) as { name?: string; desc?: string };
    return {
      name: obj.name ?? "",
      desc: rewriteCrossRefs(obj.desc ?? "", edition),
    };
  });
}
