import type { Choice } from "./choice";
import type { Resource, ResourceConsumption } from "./resource";
import type { Attack } from "./attack";
import type { FeatureEffect } from "./feature-effect";

/**
 * Recharge / per-day usage limits on a Feature (e.g. monster action).
 *
 * - `recharge_on_roll`: at the start of each turn, recharges on a d6 roll
 *   ≥ `param`. Renders as "Recharge {param}-6" (or "Recharge 6" when param=6).
 * - `per_day`: usable `param` times per day. Renders as "{param}/Day".
 * - `per_short_rest` / `per_long_rest`: usable `param` times per rest.
 */
export interface FeatureRecharge {
  type: "recharge_on_roll" | "per_day" | "per_short_rest" | "per_long_rest";
  param: number;
}

export interface Feature {
  id?: string;
  name: string;
  description?: string;
  entries?: string[];
  choices?: Choice[];
  grants_resource?: string;
  consumes?: ResourceConsumption;
  attacks?: Attack[];
  action?: "action" | "bonus-action" | "reaction" | "free" | "special";
  trigger?: string;
  dc_formula?: string;
  effects?: FeatureEffect[];
  sub_features?: Feature[];
  resources?: Resource[];
  recharge?: FeatureRecharge;
}
