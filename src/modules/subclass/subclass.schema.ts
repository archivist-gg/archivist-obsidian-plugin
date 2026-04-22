import { z } from "zod";
import { featureSchema } from "../../shared/schemas/feature-schema";
import { resourceSchema } from "../../shared/schemas/resource-schema";

const editionEnum = z.enum(["2014", "2024"]);
const wikilinkRegex = /^\[\[[^[\]]+\]\]$/;

export const subclassEntitySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  parent_class: z.string().regex(wikilinkRegex, "parent_class must be a wikilink like [[rogue]]"),
  edition: editionEnum,
  source: z.string().min(1),
  description: z.string(),
  features_by_level: z.record(z.string(), z.array(featureSchema)),
  resources: z.array(resourceSchema),
});
