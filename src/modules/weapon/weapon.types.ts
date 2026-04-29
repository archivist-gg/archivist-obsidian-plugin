/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export type WeaponCategory =
  | "simple-melee"
  | "simple-ranged"
  | "martial-melee"
  | "martial-ranged"
  | "natural"
  | string;
/* eslint-enable @typescript-eslint/no-redundant-type-constituents */

export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder";

export type ConditionalProperty = { kind: "conditional"; uid: string; note: string };

export type WeaponProperty =
  | "finesse"
  | "light"
  | "heavy"
  | "two_handed"
  | "reach"
  | "special"
  | "thrown"
  | "ammunition"
  | "versatile"
  | "loading"
  | "range"
  | ConditionalProperty;

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export type WeaponTypeTag =
  | "sword"
  | "axe"
  | "bow"
  | "crossbow"
  | "club"
  | "dagger"
  | "firearm"
  | "hammer"
  | "lance"
  | "mace"
  | "net"
  | "polearm"
  | "rapier"
  | "spear"
  | "staff"
  | string;
/* eslint-enable @typescript-eslint/no-redundant-type-constituents */

export type WeaponEdition = "2014" | "2024";

export interface WeaponEntity {
  name: string;
  slug: string;
  category: WeaponCategory;
  damage: {
    dice: string;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    type: DamageType | string;
    versatile_dice?: string;
  };
  properties: WeaponProperty[];
  range?: { normal: number; long: number };
  reload?: number;
  mastery?: string[];
  type_tags?: WeaponTypeTag[];
  ammo_type?: string;
  weight?: number | string;
  cost?: string;
  source?: string;
  page?: number;
  edition: WeaponEdition;
  entries?: unknown[];
  raw?: Record<string, unknown>;
}
