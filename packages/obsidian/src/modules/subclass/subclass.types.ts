import type { Feature, Resource } from "@archivist/dnd5e";
import type { Edition, SpellcastingConfig } from "@archivist/dnd5e/class/class.types";
import type { SelectionPool, PoolGrant, TabDecl } from "@archivist/dnd5e/types/selection-pool";

export interface SubclassEntity {
  slug: string;
  name: string;
  parent_class: string;
  edition: Edition;
  source: string;
  description: string;
  spellcasting?: SpellcastingConfig | null;
  table?: Record<number, { columns?: Record<string, string | number> }>;
  features_by_level: Record<number, Feature[]>;
  resources: Resource[];
  selection_pools?: SelectionPool[];
  pool_grants?: PoolGrant[];
  tabs?: TabDecl[];
}
