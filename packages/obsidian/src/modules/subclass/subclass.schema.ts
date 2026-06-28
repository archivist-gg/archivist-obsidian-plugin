import { z } from "zod";
import { featureSchema } from "@archivist/dnd5e/schemas/feature-schema";
import { resourceSchema } from "@archivist/dnd5e/schemas/resource-schema";
import { selectionPoolSchema, poolGrantSchema, tabDeclSchema } from "@archivist/dnd5e/schemas/selection-pool-schema";

const editionEnum = z.enum(["2014", "2024"]);
const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

const casterTypeEnum = z.enum(["full", "half", "third", "pact"]);
const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const spellcastingSchema = z.object({
  caster_type: casterTypeEnum,
  ability: abilityEnum,
  preparation: z.enum(["known", "prepared"]),
  spell_list: z.string().min(1),
});

const subclassTableRowSchema = z.object({
  columns: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export const subclassEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  parent_class: z.string().regex(wikilinkRegex, "parent_class must be a wikilink like [[rogue]]"),
  edition: editionEnum,
  source: z.string().min(1),
  description: z.string(),
  spellcasting: spellcastingSchema.nullable().optional(),
  table: z.record(z.string(), subclassTableRowSchema).optional(),
  features_by_level: z.record(z.string(), z.array(featureSchema)),
  resources: z.array(resourceSchema),
  selection_pools: z.array(selectionPoolSchema).optional(),
  pool_grants: z.array(poolGrantSchema).optional(),
  tabs: z.array(tabDeclSchema).optional(),
});
