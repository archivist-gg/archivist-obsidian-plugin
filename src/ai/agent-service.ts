import type { SrdStore } from "./srd/srd-store";
import type { ArchivistSettings } from "../types/settings";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";
import { createArchivistMcpServer } from "./mcp-server";

export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  isError?: boolean;
  generatedEntity?: { type: string; data: unknown };
  totalCostUsd?: number;
  numTurns?: number;
}

export class AgentService {
  private srdStore: SrdStore;
  private mcpServer: ReturnType<typeof createArchivistMcpServer> | null = null;
  private abortController: AbortController | null = null;

  constructor(srdStore: SrdStore) {
    this.srdStore = srdStore;
  }

  isAvailable(): boolean {
    try {
      require.resolve("@anthropic-ai/claude-agent-sdk");
      return true;
    } catch {
      return false;
    }
  }

  async *sendMessage(
    message: string,
    settings: ArchivistSettings,
    context: SystemPromptContext,
    model?: string,
  ): AsyncGenerator<StreamEvent> {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    if (!this.mcpServer) {
      this.mcpServer = createArchivistMcpServer(this.srdStore);
    }

    this.abortController = new AbortController();

    const systemPrompt = buildSystemPrompt(context);
    const permissionMode = settings.permissionMode === "auto"
      ? "acceptEdits" as const
      : "default" as const;

    const selectedModel = model ?? settings.defaultModel;

    const activeQuery = query({
      prompt: message,
      options: {
        systemPrompt,
        model: selectedModel,
        cwd: context.ttrpgRootDir === "/" ? undefined : context.ttrpgRootDir,
        permissionMode,
        mcpServers: { archivist: this.mcpServer },
        allowedTools: ["mcp__archivist__*"],
        abortController: this.abortController,
        maxTurns: 15,
        includePartialMessages: true,
      },
    });

    try {
      for await (const msg of activeQuery) {
        if (msg.type === "assistant") {
          for (const block of (msg as any).message.content) {
            if ("text" in block && block.text) {
              yield { type: "text", content: block.text };
            }
            if ("name" in block) {
              yield {
                type: "tool_call",
                toolName: block.name,
                toolInput: block.input as Record<string, unknown>,
              };
            }
          }
        } else if (msg.type === "result") {
          if ((msg as any).subtype === "success") {
            yield {
              type: "done",
              totalCostUsd: (msg as any).total_cost_usd,
              numTurns: (msg as any).num_turns,
            };
          } else {
            yield {
              type: "error",
              content: (msg as any).errors?.join(", ") ?? "Unknown error",
              isError: true,
            };
          }
        } else if (msg.type === "stream_event") {
          const event = (msg as any).event;
          if (event?.type === "content_block_delta" && event?.delta?.type === "text_delta") {
            yield { type: "text", content: event.delta.text };
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        yield {
          type: "error",
          content: (err as Error).message ?? "Stream error",
          isError: true,
        };
      }
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }
}
