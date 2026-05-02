import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface ItemBonuses {
  weapon_attack?: number | string;
  weapon_damage?: number | string;
  ac?: number | string;
  spell_attack?: number | string;
  spell_save_dc?: number | string;
  saving_throws?: number | string;
  ability_scores?: {
    static?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
    bonus?: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  };
  speed?: {
    walk?: number;
    fly?: number | "walk";
    swim?: number;
    climb?: number;
  };
}

export interface ItemAttachedSpells {
  will?: string[];
  daily?: Record<string, string[]>;
  rest?: Record<string, string[]>;
  limited?: Record<string, string[]>;
  charges?: Record<string, string[]>;
}

export interface ItemCharges {
  max: number;
  recharge?: string;
  recharge_amount?: string;
}

export interface ItemAttunement {
  required: boolean;
  restriction?: string;
  tags?: Array<Record<string, unknown>>;
}

export interface ItemCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  rarity: string;
  type?: string;
  description: string;
  attunement?: ItemAttunement;
  base_item?: string;
  weight?: number;
  cost?: string;
  bonuses?: ItemBonuses;
  attached_spells?: ItemAttachedSpells;
  charges?: ItemCharges;
  tier?: number | "major" | "minor";
  /** foundry-items activation/save/damage records — pass-through for now. */
  effects?: unknown[];
}

export const itemMergeRule: MergeRule = {
  kind: "item",
  pickOverlay(_overlay: Overlay, _slug: string): unknown {
    // Overlay is not yet used for items in this initial implementation.
    // The seed overlay has no item entries; a follow-up will introduce
    // conditional bonuses (e.g. Bracers of Defense `bonuses.ac.when: ['no_armor', 'no_shield']`).
    return null;
  },
};

type ScalarBonusKey =
  | "weapon_attack"
  | "weapon_damage"
  | "ac"
  | "spell_attack"
  | "spell_save_dc"
  | "saving_throws";

const STRUCTURED_BONUS_KEYS: Array<[string, ScalarBonusKey]> = [
  ["bonusWeapon", "weapon_attack"],
  ["bonusWeaponAttack", "weapon_attack"],
  ["bonusWeaponDamage", "weapon_damage"],
  ["bonusAc", "ac"],
  ["bonusSpellAttack", "spell_attack"],
  ["bonusSpellSaveDc", "spell_save_dc"],
  ["bonusSavingThrow", "saving_throws"],
  // bonusAbilityCheck intentionally omitted — no runtime consumer (I13).
];

/**
 * Map Open5e v2 `category.key` values onto the runtime-friendly `type`
 * string used by the item parser/renderer. Unknown keys fall through with
 * hyphens replaced by spaces.
 */
const CATEGORY_TO_TYPE: Record<string, string> = {
  "wondrous-item": "wondrous item",
  weapon: "weapon",
  armor: "armor",
  shield: "shield",
  potion: "potion",
  ring: "ring",
  rod: "rod",
  scroll: "scroll",
  staff: "staff",
  wand: "wand",
  ammunition: "ammunition",
};

function normalizeRarity(field: unknown): string {
  if (field && typeof field === "object" && "key" in field) {
    const key = field.key;
    if (typeof key === "string") return key.toLowerCase().replace(/-/g, " ");
  }
  if (typeof field === "string") return field.toLowerCase().replace(/-/g, " ");
  return "";
}

function categoryKey(field: unknown): string | undefined {
  if (field && typeof field === "object" && "key" in field) {
    const key = field.key;
    if (typeof key === "string") return key;
  }
  if (typeof field === "string") return field;
  return undefined;
}

function compendiumLabel(edition: "2014" | "2024"): string {
  return edition === "2014" ? "SRD 5e" : "SRD 2024";
}

export function toItemCanonical(entry: CanonicalEntry): ItemCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const activation = entry.activation as Record<string, unknown> | null;

  const requiresAttunement = base.requires_attunement === true;

  const out: ItemCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    rarity: normalizeRarity(base.rarity),
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
  };

  // category → type (string)
  const catKey = categoryKey(base.category);
  if (catKey) {
    out.type = CATEGORY_TO_TYPE[catKey] ?? catKey.replace(/-/g, " ");
  }

  // Weight: prefer Open5e (base) when non-zero; fall back to the
  // structured-rules dump (which has weight as a number for items Open5e
  // emits as "0.000" or omits entirely — e.g. Necklace of Fireballs).
  if (typeof base.weight === "string") {
    const w = parseFloat(base.weight);
    if (!Number.isNaN(w) && w > 0) out.weight = w;
  } else if (typeof base.weight === "number" && base.weight > 0) {
    out.weight = base.weight;
  }
  if (out.weight === undefined && structured && typeof structured.weight === "number" && structured.weight > 0) {
    out.weight = structured.weight;
  }

  // Open5e cost is a string like "0.00" (or null); skip empties / zeros.
  if (typeof base.cost === "string" && base.cost.length > 0 && base.cost !== "0.00") {
    out.cost = base.cost;
  }

  // base_item wikilink for magical weapons / armor (Open5e v2 sub-objects).
  const compendium = compendiumLabel(entry.edition);
  const weapon = base.weapon as { name?: string } | null | undefined;
  const armor = base.armor as { name?: string } | null | undefined;
  if (weapon && typeof weapon === "object" && typeof weapon.name === "string") {
    out.base_item = `[[${compendium}/Weapons/${weapon.name}]]`;
  } else if (armor && typeof armor === "object" && typeof armor.name === "string") {
    out.base_item = `[[${compendium}/Armor/${armor.name}]]`;
  }

  // Attunement: canonical { required, restriction?, tags? } shape.
  const attunementDetail = base.attunement_detail;
  if (requiresAttunement || (typeof attunementDetail === "string" && attunementDetail.length > 0)) {
    out.attunement = { required: requiresAttunement };
    if (typeof attunementDetail === "string" && attunementDetail.length > 0) {
      out.attunement.restriction = attunementDetail;
    }
  }

  // Structured-rules enrichment.
  if (structured) {
    const bonuses: ItemBonuses = {};
    for (const [src, dst] of STRUCTURED_BONUS_KEYS) {
      const v = structured[src];
      if (typeof v === "number" || typeof v === "string") {
        // Avoid overwriting an earlier bonus key with a later alias (e.g.
        // bonusWeapon → weapon_attack should win over bonusWeaponAttack → weapon_attack).
        if (bonuses[dst] === undefined) bonuses[dst] = v;
      }
    }
    if (Object.keys(bonuses).length > 0) out.bonuses = bonuses;

    // ability_scores from structured-rules `ability: { static, bonus }`.
    if (structured.ability && typeof structured.ability === "object") {
      const src = structured.ability as Record<string, unknown>;
      const abilityScores: NonNullable<ItemBonuses["ability_scores"]> = {};
      if (src.static && typeof src.static === "object") {
        abilityScores.static = src.static;
      }
      if (src.bonus && typeof src.bonus === "object") {
        abilityScores.bonus = src.bonus;
      }
      if (Object.keys(abilityScores).length > 0) {
        out.bonuses = out.bonuses ?? {};
        out.bonuses.ability_scores = abilityScores;
      }
    }

    // Speed from structured-rules `modifySpeed: { static, bonus, multiply }`.
    // Multiplicative speed (e.g. boots that double walk speed) is NOT supported
    // by the existing `bonuses.speed` schema; deferred to a follow-up. Static
    // and bonus shapes are mapped 1:1.
    if (structured.modifySpeed && typeof structured.modifySpeed === "object") {
      const src = structured.modifySpeed as Record<string, unknown>;
      const speed: NonNullable<ItemBonuses["speed"]> = {};
      const apply = (block: unknown): void => {
        if (!block || typeof block !== "object") return;
        const obj = block as Record<string, unknown>;
        for (const k of ["walk", "fly", "swim", "climb"] as const) {
          const v = obj[k];
          if (typeof v === "number") speed[k] = v;
          else if (k === "fly" && v === "walk") speed.fly = "walk";
        }
      };
      apply(src.static);
      apply(src.bonus);
      // Intentional: src.multiply is dropped.
      if (Object.keys(speed).length > 0) {
        out.bonuses = out.bonuses ?? {};
        out.bonuses.speed = speed;
      }
    }

    if (structured.attachedSpells && typeof structured.attachedSpells === "object") {
      const src = structured.attachedSpells as Record<string, unknown>;
      const attached: ItemAttachedSpells = {};
      if (Array.isArray(src.will)) attached.will = src.will as string[];
      if (src.daily && typeof src.daily === "object") attached.daily = src.daily as Record<string, string[]>;
      if (src.rest && typeof src.rest === "object") attached.rest = src.rest as Record<string, string[]>;
      if (src.limited && typeof src.limited === "object") attached.limited = src.limited as Record<string, string[]>;
      if (src.charges && typeof src.charges === "object") attached.charges = src.charges as Record<string, string[]>;
      if (Object.keys(attached).length > 0) out.attached_spells = attached;
    }

    if (Array.isArray(structured.reqAttuneTags) && structured.reqAttuneTags.length > 0) {
      out.attunement = out.attunement ?? { required: requiresAttunement };
      out.attunement.tags = structured.reqAttuneTags as Array<Record<string, unknown>>;
    }

    if (typeof structured.charges === "number") {
      const charges: ItemCharges = { max: structured.charges };
      if (typeof structured.recharge === "string") charges.recharge = structured.recharge;
      if (typeof structured.rechargeAmount === "string") charges.recharge_amount = structured.rechargeAmount;
      out.charges = charges;
    }

    // tier: structured-rules uses string "major" | "minor"; pass through as-is.
    // Numeric tiers come from test fixtures and stay as numbers for now.
    if (typeof structured.tier === "number") {
      out.tier = structured.tier;
    } else if (structured.tier === "major" || structured.tier === "minor") {
      out.tier = structured.tier;
    } else if (typeof structured.tier === "string") {
      const parsed = Number.parseInt(structured.tier, 10);
      if (!Number.isNaN(parsed)) out.tier = parsed;
    }
  }

  if (activation && Array.isArray(activation.effects)) {
    out.effects = activation.effects as unknown[];
  }

  return out;
}
