import type { Choice } from "./choice";
import type { Resource, ResourceConsumption } from "./resource";
import type { Attack } from "./attack";
import type { FeatureEffect } from "./feature-effect";

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
}
