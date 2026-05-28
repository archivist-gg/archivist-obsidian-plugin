import type { Feature, Resource } from "../../shared/types";
import type { Edition } from "../class/class.types";

export interface SubclassEntity {
  slug: string;
  name: string;
  parent_class: string;
  edition: Edition;
  source: string;
  description: string;
  features_by_level: Record<number, Feature[]>;
  resources: Resource[];
}
