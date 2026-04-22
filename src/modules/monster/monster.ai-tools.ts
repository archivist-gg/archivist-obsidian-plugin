import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "./monster.ai-schema";
import { enrichMonster } from "./monster.enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  `Generate a D&D 5e monster stat block. Provide all fields in the structured format. Use 'abilities' for ability scores, 'entries' arrays for feature/action descriptions, arrays for senses/languages/immunities, and objects for ac/hp/speed.

IMPORTANT: In all trait/action/reaction/legendary 'entries' text, use inline formula tags instead of static numbers for attack rolls, damage, and save DCs. This enables auto-recalculation when ability scores change in edit mode.

Tag syntax (always wrapped in backticks within the entry string):
- \`atk:ABILITY\` — attack bonus (ability mod + proficiency). Example: \`atk:STR\`, \`atk:DEX\`
- \`damage:DICEdNOTATION+ABILITY\` — damage roll with ability mod. Example: \`damage:1d6+STR\`, \`damage:2d6+DEX\`
- \`damage:DICEdNOTATION\` — static damage dice with no ability mod. Example: \`damage:2d6\`
- \`dc:ABILITY\` — save DC (8 + proficiency + ability mod). Example: \`dc:WIS\`, \`dc:CON\`

Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).
Use STR for melee weapon attacks, DEX for ranged/finesse weapon attacks, and the appropriate spellcasting ability for spell attacks/DCs.

Example action entries:
- "Melee Weapon Attack: \`atk:STR\` to hit, reach 5 ft., one target. Hit: \`damage:2d6+STR\` slashing damage."
- "Ranged Weapon Attack: \`atk:DEX\` to hit, range 80/320 ft., one target. Hit: \`damage:1d6+DEX\` piercing damage."
- "Each creature in the area must make a \`dc:CON\` Constitution saving throw, taking \`damage:8d6\` fire damage on a failed save, or half as much on a success."`,
  { monster: monsterInputSchema },
  ({ monster }) => {
    try {
      const enriched = enrichMonster(monster);
      return Promise.resolve({ content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }] });
    } catch (e) {
      return Promise.resolve({ content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true });
    }
  },
  { annotations: { readOnlyHint: true } },
);
