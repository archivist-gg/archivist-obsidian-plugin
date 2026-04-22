import type { Ability } from "./choice";

export interface AttackRange {
  normal?: number;
  long?: number;
  reach?: number;
}

export interface Attack {
  name: string;
  type: "melee" | "ranged" | "spell";
  ability?: Ability[] | Ability;
  damage?: string;
  damage_type?: string;
  action?: "action" | "bonus-action" | "reaction";
  properties?: string[];
  range?: AttackRange;
  condition?: string;
}
