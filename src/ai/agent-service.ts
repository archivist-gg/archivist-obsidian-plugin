import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { SrdStore } from "./srd/srd-store";
import type { ArchivistSettings } from "../types/settings";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";
import { createArchivistMcpServer } from "./mcp-server";

export interface StreamEvent {
  type: "text_delta" | "thinking_start" | "thinking_delta" | "thinking_end"
      | "tool_call_start" | "tool_input_delta" | "tool_call_end" | "tool_result"
      | "usage" | "compact_boundary"
      | "error" | "done";
  /** Accumulated partial JSON buffer for tool input streaming */
  partialJson?: string;
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  isError?: boolean;
  generatedEntity?: { type: string; data: unknown };
  totalCostUsd?: number;
  numTurns?: number;
  durationMs?: number;
  inputTokens?: number;
  contextTokens?: number;
}

export class AgentService {
  private srdStore: SrdStore;
  private mcpServer: ReturnType<typeof createArchivistMcpServer> | null = null;
  private abortController: AbortController | null = null;

  private claudePath: string | null = null;

  constructor(srdStore: SrdStore) {
    this.srdStore = srdStore;
    this.claudePath = this.findClaudePath();
  }

  isAvailable(): boolean {
    return this.claudePath !== null;
  }

  private findClaudePath(): string | null {
    // Check common install locations
    const candidates: string[] = [];

    // Native install locations
    if (process.platform === "darwin") {
      candidates.push("/usr/local/bin/claude");
      candidates.push(path.join(os.homedir(), ".local", "bin", "claude"));
    } else if (process.platform === "win32") {
      candidates.push(path.join(os.homedir(), "AppData", "Local", "Programs", "claude-code", "claude.exe"));
    } else {
      candidates.push("/usr/local/bin/claude");
      candidates.push(path.join(os.homedir(), ".local", "bin", "claude"));
    }

    // npm global install locations
    const npmGlobalPaths = [
      path.join(os.homedir(), ".npm-global", "lib", "node_modules", "@anthropic-ai", "claude-code", "cli.js"),
      "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
      "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js",
    ];
    candidates.push(...npmGlobalPaths);

    // Search PATH entries
    const pathEnv = process.env.PATH || "";
    const pathEntries = pathEnv.split(path.delimiter);
    for (const dir of pathEntries) {
      candidates.push(path.join(dir, "claude"));
      if (process.platform === "win32") {
        candidates.push(path.join(dir, "claude.exe"));
      }
    }

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  async *sendMessage(
    message: string,
    settings: ArchivistSettings,
    context: SystemPromptContext,
    model?: string,
    thinkingBudget?: string,
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

    if (!this.claudePath) {
      yield { type: "error", content: "Claude Code CLI not found. Install Claude Code to use Archivist Inquiry.", isError: true };
      return;
    }

    const queryOptions: any = {
      prompt: message,
      options: {
        systemPrompt,
        model: selectedModel,
        cwd: context.ttrpgRootDir,
        pathToClaudeCodeExecutable: this.claudePath,
        permissionMode,
        mcpServers: { archivist: this.mcpServer },
        allowedTools: ["mcp__archivist__*"],
        abortController: this.abortController,
        maxTurns: 15,
        includePartialMessages: true,
      },
    };
    // Map effort levels to thinking token budgets
    const effortMap: Record<string, number> = { low: 4000, medium: 8000, high: 16000, max: 32000 };
    const budgetTokens = effortMap[thinkingBudget ?? ""];
    if (budgetTokens) {
      queryOptions.options.maxThinkingTokens = budgetTokens;
    }

    const activeQuery = query(queryOptions);

    const startTime = Date.now();
    // Track which content block index is what type, for content_block_stop
    const blockTypes: Record<number, "thinking" | "tool_use" | "text"> = {};
    // Accumulate tool input JSON per block index
    const toolInputBuffers: Record<number, string> = {};
    // Track tool IDs and names per block index
    const toolMeta: Record<number, { id: string; name: string }> = {};
    // Deduplication: track tool IDs and text already emitted via stream_event
    const emittedToolIds = new Set<string>();
    let hasStreamedText = false;

    try {
      for await (const msg of activeQuery) {

        if (msg.type === "stream_event") {
          const event = (msg as any).event;
          if (!event) continue;

          if (event.type === "content_block_start") {
            const block = event.content_block;
            const idx = event.index ?? 0;

            if (block?.type === "thinking") {
              blockTypes[idx] = "thinking";
              yield { type: "thinking_start" };
            } else if (block?.type === "tool_use") {
              blockTypes[idx] = "tool_use";
              toolInputBuffers[idx] = "";
              toolMeta[idx] = { id: block.id ?? "", name: block.name ?? "" };
              emittedToolIds.add(block.id ?? "");
              yield {
                type: "tool_call_start",
                toolCallId: block.id,
                toolName: block.name,
              };
            } else if (block?.type === "text") {
              blockTypes[idx] = "text";
            }
          } else if (event.type === "content_block_delta") {
            const delta = event.delta;
            const idx = event.index ?? 0;
            if (delta?.type === "thinking_delta") {
              yield { type: "thinking_delta", content: delta.thinking ?? "" };
            } else if (delta?.type === "text_delta") {
              hasStreamedText = true;
              yield { type: "text_delta", content: delta.text ?? "" };
            } else if (delta?.type === "input_json_delta") {
              if (toolInputBuffers[idx] !== undefined) {
                toolInputBuffers[idx] += delta.partial_json ?? "";
                // Yield every delta -- no throttle. LLM token speed is already slow enough.
                const meta = toolMeta[idx];
                if (meta) {

                  yield {
                    type: "tool_input_delta",
                    toolCallId: meta.id,
                    toolName: meta.name,
                    partialJson: toolInputBuffers[idx],
                  };
                }
              }
            }
          } else if (event.type === "content_block_stop") {
            const idx = event.index ?? 0;
            const btype = blockTypes[idx];
            if (btype === "thinking") {
              yield { type: "thinking_end" };
            } else if (btype === "tool_use") {
              let parsedInput: Record<string, unknown> = {};
              try {
                parsedInput = JSON.parse(toolInputBuffers[idx] || "{}");
              } catch { /* ignore parse errors */ }
              yield {
                type: "tool_call_end",
                toolCallId: toolMeta[idx]?.id,
                toolName: toolMeta[idx]?.name,
                toolInput: parsedInput,
              };
            }
            delete blockTypes[idx];
          }
        } else if (msg.type === "assistant") {
          // Complete assistant message -- skip blocks already emitted via stream_event
          for (const block of (msg as any).message?.content ?? []) {
            if ("text" in block && block.text && !hasStreamedText) {
              yield { type: "text_delta", content: block.text };
            }
            if ("name" in block && !emittedToolIds.has(block.id)) {
              yield {
                type: "tool_call_start",
                toolCallId: block.id,
                toolName: block.name,
                toolInput: block.input as Record<string, unknown>,
              };
            }
          }
          // Emit usage information
          const usage = (msg as any).message?.usage;
          if (usage) {
            const contextTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
            yield { type: "usage", inputTokens: usage.input_tokens, contextTokens };
          }
        } else if (msg.type === "system" && (msg as any).subtype === "compact_boundary") {
          yield { type: "compact_boundary" };
        } else if (msg.type === "user") {
          // Tool result messages from the SDK
          const content = (msg as any).message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_result") {
                const resultText = typeof block.content === "string"
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content.map((c: any) => c.text ?? "").join("")
                    : JSON.stringify(block.content);
                yield {
                  type: "tool_result",
                  toolCallId: block.tool_use_id,
                  toolResult: resultText,
                  isError: block.is_error === true,
                };
              }
            }
          }
        } else if (msg.type === "result") {
          const durationMs = Date.now() - startTime;
          if ((msg as any).subtype === "success") {
            yield {
              type: "done",
              totalCostUsd: (msg as any).total_cost_usd,
              numTurns: (msg as any).num_turns,
              durationMs,
            };
          } else {
            yield {
              type: "error",
              content: (msg as any).errors?.join(", ") ?? "Unknown error",
              isError: true,
              durationMs,
            };
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        yield {
          type: "error",
          content: (err as Error).message ?? "Stream error",
          isError: true,
          durationMs: Date.now() - startTime,
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
