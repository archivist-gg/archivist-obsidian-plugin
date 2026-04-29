import type { MergeRule, CanonicalEntry } from "../merger";
import type { Overlay } from "../overlay.schema";
import { rewriteCrossRefs } from "../cross-ref-map";

export interface ItemBonuses {
  attack?: number | string;
  ac?: number | string;
  spell_attack?: number | string;
  spell_save_dc?: number | string;
  saving_throw?: number | string;
  ability_check?: number | string;
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

export interface ItemCanonical {
  slug: string;
  name: string;
  edition: "2014" | "2024";
  source: string;
  rarity: string;
  description: string;
  requires_attunement: boolean;
  attunement?: { tags: Array<Record<string, unknown>> };
  bonuses?: ItemBonuses;
  attached_spells?: ItemAttachedSpells;
  charges?: ItemCharges;
  tier?: number;
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

const STRUCTURED_BONUS_KEYS: Array<[string, keyof ItemBonuses]> = [
  ["bonusWeapon", "attack"],
  ["bonusAc", "ac"],
  ["bonusSpellAttack", "spell_attack"],
  ["bonusSpellSaveDc", "spell_save_dc"],
  ["bonusSavingThrow", "saving_throw"],
  ["bonusAbilityCheck", "ability_check"],
];

export function toItemCanonical(entry: CanonicalEntry): ItemCanonical {
  const base = entry.base as Record<string, unknown>;
  const structured = entry.structured as Record<string, unknown> | null;
  const activation = entry.activation as Record<string, unknown> | null;

  const out: ItemCanonical = {
    slug: entry.slug,
    name: base.name as string,
    edition: entry.edition,
    source: entry.edition === "2014" ? "SRD 5.1" : "SRD 5.2",
    rarity: (base.rarity as string | undefined) ?? "",
    description: rewriteCrossRefs((base.desc as string) ?? "", entry.edition),
    requires_attunement: base.requires_attunement === true,
  };

  // Structured-rules: bonus.* fields → bonuses
  if (structured) {
    const bonuses: ItemBonuses = {};
    for (const [src, dst] of STRUCTURED_BONUS_KEYS) {
      const v = structured[src];
      if (typeof v === "number" || typeof v === "string") {
        bonuses[dst] = v;
      }
    }
    if (Object.keys(bonuses).length > 0) out.bonuses = bonuses;

    // attachedSpells (same shape, snake-cased key)
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

    // reqAttuneTags → attunement.tags
    if (Array.isArray(structured.reqAttuneTags) && structured.reqAttuneTags.length > 0) {
      out.attunement = { tags: structured.reqAttuneTags as Array<Record<string, unknown>> };
    }

    // charges/recharge/rechargeAmount → charges
    if (typeof structured.charges === "number") {
      const charges: ItemCharges = { max: structured.charges };
      if (typeof structured.recharge === "string") charges.recharge = structured.recharge;
      if (typeof structured.rechargeAmount === "string") charges.recharge_amount = structured.rechargeAmount;
      out.charges = charges;
    }

    // tier
    if (typeof structured.tier === "number") {
      out.tier = structured.tier;
    } else if (typeof structured.tier === "string") {
      const parsed = Number.parseInt(structured.tier, 10);
      if (!Number.isNaN(parsed)) out.tier = parsed;
    }
  }

  // foundry-items activation/save/damage → effects (pass-through)
  if (activation && Array.isArray(activation.effects)) {
    out.effects = activation.effects as unknown[];
  }

  return out;
}
