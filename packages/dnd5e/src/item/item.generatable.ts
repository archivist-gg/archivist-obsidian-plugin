import type { Generatable } from "@archivist/core";
import { itemInputSchema } from "./item.ai-schema";
import { enrichItem } from "./item.enrichment";

export const itemGeneratable: Generatable = {
  type: "item",
  description:
    "Generate a D&D 5e magic item. Provide all fields in the structured format. Use 'entries' as an array of description strings.",
  instructions: `In item 'entries' text, use inline formula tags for attack rolls, damage, and save DCs where applicable:
- \`atk:ABILITY\` for attack bonuses. Example: \`atk:STR\`
- \`damage:DICEdNOTATION+ABILITY\` for damage. Example: \`damage:1d8+STR\`
- \`dc:ABILITY\` for save DCs. Example: \`dc:CHA\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example entry: "On a hit, the target takes an extra \`damage:2d6\` fire damage."`,
  inputSchema: itemInputSchema,
  enrich: (input) => enrichItem(input as Record<string, unknown>),
};
