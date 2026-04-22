import { tool } from "@anthropic-ai/claude-agent-sdk";
import { npcInputSchema } from "./npc.ai-schema";

export const generateNpcTool = tool(
  "generate_npc",
  "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  { npc: npcInputSchema },
  ({ npc }) => {
    return Promise.resolve({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "npc", params: npc }),
      }],
    });
  },
  { annotations: { readOnlyHint: true } },
);
