import type { Generatable } from "@archivist/core";
import { monsterInputSchema } from "./monster.ai-schema";
import { enrichMonster } from "./monster.enrichment";

export const monsterGeneratable: Generatable = {
  type: "monster",
  description: "Generate a D&D 5e monster stat block.",
  instructions:
    "Return a complete stat block; CR-derived fields (proficiency bonus, XP) are filled automatically.",
  inputSchema: monsterInputSchema,
  enrich: (input) => enrichMonster(input as Record<string, unknown>),
};
