import { tool } from "@anthropic-ai/claude-agent-sdk";
import type { AnyZodRawShape, SdkMcpToolDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { Generatable } from "@archivist/core";

/**
 * Turn any {@link Generatable} into a Claude Agent SDK tool. Generic over the
 * domain: the tool name, description, input shape, and result envelope are all
 * derived from the Generatable contract, so a pack can expose its generators
 * without the generators package knowing anything domain-specific.
 *
 * The input schema is wrapped under the type key (`{ [g.type]: g.inputSchema }`)
 * and the handler envelopes the enriched output as
 * `{ type, data }` JSON text — matching the legacy `generateMonsterTool`.
 */
export function generatableToSdkTool(g: Generatable): SdkMcpToolDefinition {
  const name = g.toolName ?? `generate_${g.type}`;
  const description = g.instructions ? `${g.description}\n\n${g.instructions}` : g.description;
  const inputSchema = { [g.type]: g.inputSchema } as unknown as AnyZodRawShape;
  return tool(
    name,
    description,
    inputSchema,
    (input) => {
      const data = g.enrich((input as Record<string, unknown>)[g.type]);
      return Promise.resolve({
        content: [{ type: "text" as const, text: JSON.stringify({ type: g.type, data }) }],
      });
    },
    { annotations: { readOnlyHint: true } },
  );
}
