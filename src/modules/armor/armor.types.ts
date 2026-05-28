// Reuse the existing shared Ability type rather than redeclaring it.
export type { Ability } from "../../shared/types/choice";

/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export type ArmorCategory =
  | "light"
  | "medium"
  | "heavy"
  | "shield"
  | "natural"
  | "feature"
  | "spell"
  | string;
/* eslint-enable @typescript-eslint/no-redundant-type-constituents */

export interface ArmorEntity {
  name: string;
  slug: string;
  category: ArmorCategory;
  ac: {
    base: number;
    flat: number;
    add_dex: boolean;
    dex_max?: number;
    add_con: boolean;
    add_wis: boolean;
    description?: string;
  };
  strength_requirement?: number;
  stealth_disadvantage?: boolean;
  weight?: number | string;
  cost?: string;
  rarity?: string;
  source?: string;
  page?: number;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  edition?: "2014" | "2024" | string;
  entries?: unknown[];
  raw?: Record<string, unknown>;
}
