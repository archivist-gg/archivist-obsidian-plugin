import { tool } from "@anthropic-ai/claude-agent-sdk";
import { spellInputSchema } from "./spell.ai-schema";
import { enrichSpell } from "./spell.enrichment";

export const generateSpellTool = tool(
  "generate_spell",
  `Generate a D&D 5e spell. Provide all fields in the structured format. Use 'description' as an array of paragraph strings, not a single string.

In spell description text, use inline formula tags for damage and save DCs where applicable:
- \`damage:DICEdNOTATION\` for damage dice. Example: \`damage:8d6\`
- \`dc:ABILITY\` for save DCs (resolves to 8 + proficiency + ability mod of the caster). Example: \`dc:WIS\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example description entry: "Each creature in a 20-foot radius must make a \`dc:WIS\` Dexterity saving throw. A target takes \`damage:8d6\` fire damage on a failed save, or half as much on a success."`,
  { spell: spellInputSchema },
  ({ spell }) => {
    try {
      const enriched = enrichSpell(spell);
      return Promise.resolve({ content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }] });
    } catch (e) {
      return Promise.resolve({ content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true });
    }
  },
  { annotations: { readOnlyHint: true } },
);
