import { tool } from "@anthropic-ai/claude-agent-sdk";
import { searchSrdInput, getSrdEntityInput } from "../schemas/srd-schema";
import type { SrdStore } from "../srd/srd-store";

export function createSrdTools(store: SrdStore) {
  const searchSrdTool = tool(
    "search_srd",
    "Search the D&D 5e SRD database for monsters, spells, or magic items by name. Returns summary results.",
    searchSrdInput,
    async ({ query, entity_type, limit }) => {
      const results = store.search(query, entity_type as "monster" | "spell" | "item" | undefined, limit);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    },
    { annotations: { readOnlyHint: true } },
  );

  const getSrdEntityTool = tool(
    "get_srd_entity",
    "Get complete details for a specific D&D 5e SRD entity by exact name. Returns the full stat block / spell / item data.",
    getSrdEntityInput,
    async ({ name, entity_type }) => {
      const entity = store.getByName(name, entity_type as "monster" | "spell" | "item");
      if (!entity) {
        return {
          content: [{ type: "text" as const, text: `Entity "${name}" not found in SRD.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entity) }],
      };
    },
    { annotations: { readOnlyHint: true } },
  );

  return { searchSrdTool, getSrdEntityTool };
}
