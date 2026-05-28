import { tool } from "@anthropic-ai/claude-agent-sdk";
import { itemInputSchema } from "./item.ai-schema";
import { enrichItem } from "./item.enrichment";

export const generateItemTool = tool(
  "generate_item",
  `Generate a D&D 5e magic item. Provide all fields in the structured format. Use 'entries' as an array of description strings.

In item 'entries' text, use inline formula tags for attack rolls, damage, and save DCs where applicable:
- \`atk:ABILITY\` for attack bonuses. Example: \`atk:STR\`
- \`damage:DICEdNOTATION+ABILITY\` for damage. Example: \`damage:1d8+STR\`
- \`dc:ABILITY\` for save DCs. Example: \`dc:CHA\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example entry: "On a hit, the target takes an extra \`damage:2d6\` fire damage."`,
  { item: itemInputSchema },
  ({ item }) => {
    try {
      const enriched = enrichItem(item);
      return Promise.resolve({ content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }] });
    } catch (e) {
      return Promise.resolve({ content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true });
    }
  },
  { annotations: { readOnlyHint: true } },
);
