import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "../schemas/monster-schema";
import { spellInputSchema } from "../schemas/spell-schema";
import { itemInputSchema } from "../schemas/item-schema";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichMonster, enrichSpell, enrichItem } from "../validation/entity-enrichment";

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
  async ({ monster }) => {
    try {
      const enriched = enrichMonster(monster);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateSpellTool = tool(
  "generate_spell",
  `Generate a D&D 5e spell. Provide all fields in the structured format. Use 'description' as an array of paragraph strings, not a single string.

In spell description text, use inline formula tags for damage and save DCs where applicable:
- \`damage:DICEdNOTATION\` for damage dice. Example: \`damage:8d6\`
- \`dc:ABILITY\` for save DCs (resolves to 8 + proficiency + ability mod of the caster). Example: \`dc:WIS\`
Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).

Example description entry: "Each creature in a 20-foot radius must make a \`dc:WIS\` Dexterity saving throw. A target takes \`damage:8d6\` fire damage on a failed save, or half as much on a success."`,
  { spell: spellInputSchema },
  async ({ spell }) => {
    try {
      const enriched = enrichSpell(spell);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

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
  async ({ item }) => {
    try {
      const enriched = enrichItem(item);
      return { content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Validation error: ${e}` }], isError: true };
    }
  },
  { annotations: { readOnlyHint: true } },
);

export const generateEncounterTool = tool(
  "generate_encounter",
  "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  { encounter: encounterInputSchema },
  async ({ encounter }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "encounter", params: encounter }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateNpcTool = tool(
  "generate_npc",
  "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  { npc: npcInputSchema },
  async ({ npc }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "npc", params: npc }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);
