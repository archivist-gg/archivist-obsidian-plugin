// src/modules/item/item.actions-map.ts

import type { EquipmentEntry } from "../pc/pc.types";

export type ActionCost = "action" | "bonus-action" | "reaction" | "free" | "special";

export interface ItemAction {
  cost: ActionCost;
  range?: string;
  max_charges?: number;
  recovery?: { amount: string; reset: "dawn" | "short" | "long" | "special" };
}

/**
 * Curated map of canonical SRD chargeable / activated items.
 * Slugs match the SRD compendium slug format. Augmenter reads this map
 * and stamps `actions: ItemAction` onto the augmented entity bundle.
 */
export const ITEM_ACTIONS: Record<string, ItemAction> = {
  // Wands and rods
  "wand-of-fireballs":           { cost: "action",       range: "150 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-magic-missiles":      { cost: "action",       range: "120 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-lightning-bolts":     { cost: "action",       range: "100 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-paralysis":           { cost: "action",       range: "60 ft.",  max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-fear":                { cost: "action",       range: "self",    max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-binding":             { cost: "action",       range: "self",    max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-secrets":             { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "1d3",   reset: "dawn" } },
  "wand-of-web":                 { cost: "action",       range: "60 ft.",  max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },
  "wand-of-wonder":              { cost: "action",       range: "120 ft.", max_charges: 7, recovery: { amount: "1d6+1", reset: "dawn" } },

  // Activatable wondrous items
  "boots-of-speed":              { cost: "bonus-action", range: "self",    max_charges: 1, recovery: { amount: "1",     reset: "long" } },
  "boots-of-levitation":         { cost: "action",       range: "self" },
  "boots-of-striding-and-springing": { cost: "free",     range: "self" },
  "broom-of-flying":             { cost: "action",       range: "touch" },
  "cloak-of-displacement":       { cost: "free",         range: "self" },
  "cloak-of-the-bat":            { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "1", reset: "long" } },
  "decanter-of-endless-water":   { cost: "action",       range: "touch" },
  "drum-of-panic":               { cost: "action",       range: "120 ft.", max_charges: 1, recovery: { amount: "1", reset: "long" } },
  "eyes-of-charming":            { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "3", reset: "dawn" } },

  // Rings
  "ring-of-three-wishes":        { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "0", reset: "special" } },
  "ring-of-shooting-stars":      { cost: "action",       range: "60 ft.",  max_charges: 6, recovery: { amount: "1d6", reset: "dawn" } },
  "ring-of-the-ram":             { cost: "action",       range: "60 ft.",  max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },
  "ring-of-spell-storing":       { cost: "action",       range: "self",    max_charges: 5 },

  // Magic weapons with activation actions (surface in items table only via override; weapons table is primary)
  "sun-blade":                   { cost: "free",         range: "self" },

  // Potions / consumables
  "potion-of-healing":           { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-greater-healing":   { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-superior-healing":  { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "potion-of-supreme-healing":   { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "alchemists-fire":             { cost: "action",       range: "20 ft.",  max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "holy-water":                  { cost: "action",       range: "20 ft.",  max_charges: 1, recovery: { amount: "0", reset: "special" } },
  "oil-of-sharpness":            { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
};

/**
 * Resolve the ItemAction for an equipped entry.
 * Priority: entry.overrides (action + range) merged onto curated map.
 * Returns null when neither source supplies an action cost.
 */
export function resolveItemAction(slug: string, entry: EquipmentEntry): ItemAction | null {
  const curated = ITEM_ACTIONS[slug] ?? null;
  const override = entry.overrides;
  const overrideCost = override?.action;
  const overrideRange = override?.range;

  if (!curated && !overrideCost) return null;

  const cost = overrideCost ?? curated?.cost;
  if (!cost) return null;

  return {
    cost,
    range: overrideRange ?? curated?.range,
    max_charges: curated?.max_charges,
    recovery: curated?.recovery,
  };
}
