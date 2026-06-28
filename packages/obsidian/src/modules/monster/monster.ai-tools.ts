import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "./monster.ai-schema";
import { enrichMonster } from "./monster.enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  `Generate a D&D 5e monster stat block. Provide all fields in the structured format. Use 'abilities' for ability scores, 'entries' arrays for feature/action descriptions, arrays for senses/languages/immunities, and objects for ac/hp/speed.

IMPORTANT: In all trait/action/reaction/legendary 'entries' text, use inline formula tags instead of static numbers for attack rolls, damage, and save DCs. This enables auto-recalculation when ability scores change in edit mode.

Tag syntax (always wrapped in backticks within the entry string):
- \`atk:ABILITY\` — ability mod alone (use for non-proficient natural attacks like ghoul bite, cat claws — when "+N to hit" doesn't include the proficiency bonus). Example: \`atk:DEX\`
- \`atk:ABILITY+PB\` — ability mod + proficiency (use for proficient attacks; the typical case for trained warriors and most predatory creatures). Example: \`atk:STR+PB\`
- \`atk:+N\` — literal bonus when ability/proficiency attribution is unknown or the value is a designed constant. Example: \`atk:+2\`
- \`atk:ABILITY+PB+N\` — magic-weapon attack with extra bonus. Example: \`atk:DEX+PB+1\`
- \`dmg:DICE+ABILITY\` — die plus ability mod. Proficiency is NEVER added to damage. Example: \`dmg:1d8+STR\`
- \`dmg:DICE\` — pure dice, no modifier. Example: \`dmg:2d6\`
- \`dmg:DICE+ABILITY+N\` — magic-weapon damage. Example: \`dmg:1d8+STR+2\`
- \`dc:ABILITY\` — 8 + ability mod + PB. PB is ALWAYS implicit; never write +PB on dc. Example: \`dc:WIS\`
- \`dc:N\` — literal DC. Example: \`dc:15\`

Valid ability keywords: STR, DEX, CON, INT, WIS, CHA (uppercase only).
Use STR for melee weapon attacks, DEX for ranged/finesse weapon attacks, and the appropriate spellcasting ability for spell attacks/DCs.

Worked examples:
- "Melee Weapon Attack: \`atk:STR+PB\` to hit, reach 5 ft. Hit: \`dmg:2d6+STR\` slashing." (proficient melee with greatsword)
- "Melee Weapon Attack: \`atk:DEX\` to hit (non-proficient bite). Hit: \`dmg:2d6+DEX\` piercing." (ghoul bite)
- "Each creature in the area must succeed on a \`dc:CON\` save, taking \`dmg:8d6\` fire damage on a fail." (breath weapon)`,
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
