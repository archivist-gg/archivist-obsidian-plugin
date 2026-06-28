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
  "ring-of-animal-influence":    { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "1d3",   reset: "dawn" } },
  "ring-of-elemental-command":   { cost: "action",       range: "self",    max_charges: 5, recovery: { amount: "1d4+1", reset: "dawn" } },
  "ring-of-evasion":             { cost: "reaction",     range: "self",    max_charges: 3, recovery: { amount: "1d3",   reset: "dawn" } },

  // Necklaces
  "necklace-of-fireballs":       { cost: "action",       range: "60 ft.",  max_charges: 9 },

  // Gems
  "gem-of-brightness":           { cost: "action",       range: "60 ft.",  max_charges: 50 },
  "gem-of-seeing":               { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },

  // Helms
  "helm-of-teleportation":       { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },

  // Medallions
  "medallion-of-thoughts":       { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },

  // Pipes
  "pipes-of-haunting":           { cost: "action",       range: "30 ft.",  max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },
  "pipes-of-the-sewers":         { cost: "action",       range: "self",    max_charges: 3, recovery: { amount: "1d3", reset: "dawn" } },

  // Cubes / chimes
  "cube-of-force":               { cost: "action",       range: "self",    max_charges: 36, recovery: { amount: "1d20", reset: "dawn" } },
  "chime-of-opening":            { cost: "action",       range: "120 ft.", max_charges: 10 },

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
  "dust-of-disappearance":       { cost: "action",       range: "self",    max_charges: 1, recovery: { amount: "0", reset: "special" } },
};

/**
 * Look up an ItemAction by slug, accepting either a bare name slug
 * (`wand-of-fireballs`) or a compendium-prefixed slug
 * (`srd-5e_wand-of-fireballs`, `srd-2024_wand-of-fireballs`,
 * `homebrew_wand-of-fireballs`).
 *
 * Compendium-prefixed slugs follow the shape `<prefix>_<name-slug>` where
 * both prefix and name-slug are kebab-case (slugify strips underscores).
 * The first underscore is therefore the unambiguous prefix separator: we
 * try the bare slug after the first underscore first, then fall back to
 * the original slug for legacy bare-slug callers.
 *
 * Returns `undefined` if no map entry matches either form. Does not crash
 * on slugs without an underscore — those are treated as already-bare.
 */
export function findItemAction(slug: string): ItemAction | undefined {
  if (slug in ITEM_ACTIONS) return ITEM_ACTIONS[slug];
  const underscore = slug.indexOf("_");
  if (underscore < 0) return undefined;
  const bare = slug.slice(underscore + 1);
  return ITEM_ACTIONS[bare];
}

/**
 * Resolve the ItemAction for an equipped entry.
 * Priority: entry.overrides (action + range) merged onto curated map.
 * Returns null when neither source supplies an action cost.
 *
 * Accepts both bare and compendium-prefixed slugs (see `findItemAction`).
 */
export function resolveItemAction(slug: string, entry: EquipmentEntry): ItemAction | null {
  const curated = findItemAction(slug) ?? null;
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
