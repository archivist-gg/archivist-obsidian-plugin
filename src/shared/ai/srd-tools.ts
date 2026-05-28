import { tool } from "@anthropic-ai/claude-agent-sdk";
import { searchSrdInput, getSrdEntityInput } from "./srd-schema";
import type { SrdStore } from "./srd-store";

export function createSrdTools(store: SrdStore) {
  const searchSrdTool = tool(
    "search_srd",
    "Search the D&D 5e SRD database for monsters, spells, magic items, armor, weapons, feats, conditions, classes, or backgrounds by name. Returns ranked summary results.",
    searchSrdInput,
    ({ query, entity_type, limit }) => {
      const results = store.search(query, entity_type, limit);
      const summary = results.map((r) => ({
        slug: r.slug,
        name: r.name,
        entityType: r.entityType,
      }));
      return Promise.resolve({
        content: [{ type: "text" as const, text: JSON.stringify(summary) }],
      });
    },
    { annotations: { readOnlyHint: true } },
  );

  const getSrdEntityTool = tool(
    "get_srd_entity",
    "Get complete details for a specific D&D 5e SRD entity by slug. Returns the full stat block / spell / item data. Falls back to name search if slug not found.",
    getSrdEntityInput,
    ({ slug, name, entity_type }) => {
      // Try slug first
      let entity = store.getBySlug(slug);

      // Fall back to exact-name search (case-insensitive)
      if (!entity && name) {
        const q = name.toLowerCase();
        const hits = store.search(name, entity_type, 20);
        entity = hits.find((e) => e.name.toLowerCase() === q);
      }

      if (!entity) {
        return Promise.resolve({
          content: [{ type: "text" as const, text: `Entity "${slug}" not found in SRD.` }],
          isError: true,
        });
      }
      return Promise.resolve({
        content: [{ type: "text" as const, text: JSON.stringify(entity.data) }],
      });
    },
    { annotations: { readOnlyHint: true } },
  );

  return { searchSrdTool, getSrdEntityTool };
}
