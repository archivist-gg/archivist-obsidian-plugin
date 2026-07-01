import type { Generatable } from "@archivist/core";
import { encounterInputSchema } from "./encounter.ai-schema";

export const encounterGeneratable: Generatable = {
  type: "encounter",
  description:
    "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  inputSchema: encounterInputSchema,
  enrich: (input) => input,
};
