import type { Generatable } from "@archivist/core";
import { npcInputSchema } from "./npc.ai-schema";

export const npcGeneratable: Generatable = {
  type: "npc",
  description:
    "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  inputSchema: npcInputSchema,
  enrich: (input) => input, // npc has no enrichment; the mapper envelopes it as {type:"npc", data}
};
