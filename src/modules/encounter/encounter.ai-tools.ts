import { tool } from "@anthropic-ai/claude-agent-sdk";
import { encounterInputSchema } from "./encounter.ai-schema";

export const generateEncounterTool = tool(
  "generate_encounter",
  "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  { encounter: encounterInputSchema },
  ({ encounter }) => {
    return Promise.resolve({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "encounter", params: encounter }),
      }],
    });
  },
  { annotations: { readOnlyHint: true } },
);
