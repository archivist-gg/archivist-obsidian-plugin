import { MarkdownRenderer, Component, type App } from "obsidian";
import { setIcon } from "obsidian";
import { renderMonsterBlock } from "../../renderers/monster-renderer";
import { renderSpellBlock } from "../../renderers/spell-renderer";
import { renderItemBlock } from "../../renderers/item-renderer";
import { parseMonster } from "../../parsers/monster-parser";
import { parseSpell } from "../../parsers/spell-parser";
import { parseItem } from "../../parsers/item-parser";
import { enhanceCodeBlocks } from "./code-block-enhancer";
import type { Message, ContentBlock } from "../../types/conversation";
import * as yaml from "js-yaml";

// ─── Saved message rendering (non-streaming) ────────────────────────────────

export function renderUserMessage(parent: HTMLElement, message: Message, callbacks?: { onRewind?: (messageId: string) => void; onFork?: (messageId: string) => void }): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-user" });
  const bubble = wrapper.createDiv({ cls: "archivist-inquiry-msg-bubble" });
  bubble.textContent = message.content;
  // Copy button (hover-reveal)
  const copyBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-copy" });
  setIcon(copyBtn, "copy");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(message.content);
    setIcon(copyBtn, "check");
    setTimeout(() => setIcon(copyBtn, "copy"), 2000);
  });
  if (callbacks?.onRewind) {
    const rewindBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-rewind" });
    setIcon(rewindBtn, "undo-2");
    rewindBtn.setAttribute("title", "Rewind to here");
    rewindBtn.addEventListener("click", () => callbacks.onRewind!(message.id));
  }
  if (callbacks?.onFork) {
    const forkBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-fork" });
    setIcon(forkBtn, "git-branch");
    forkBtn.setAttribute("title", "Fork from here");
    forkBtn.addEventListener("click", () => callbacks.onFork!(message.id));
  }
  return wrapper;
}

export function renderAssistantMessage(parent: HTMLElement, message: Message, app: App, sourcePath: string, component?: Component, callbacks?: { onFork?: (messageId: string) => void }): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-assistant" });
  const comp = component ?? new Component();

  // If contentBlocks exist, render them in order (preserves streaming layout)
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    for (const block of message.contentBlocks) {
      switch (block.type) {
        case "thinking":
          renderSavedThinkingBlock(wrapper, block.content, app, sourcePath, comp);
          break;
        case "tool_call":
          renderSavedToolCallBlock(wrapper, block.toolName, block.toolInput, block.toolResult, block.isError);
          break;
        case "text":
          if (block.content) {
            const textDiv = wrapper.createDiv({ cls: "archivist-inquiry-msg-text" });
            MarkdownRenderer.render(app, block.content, textDiv, sourcePath, comp);
            enhanceCodeBlocks(textDiv);
          }
          break;
        case "generated_entity": {
          const bw = wrapper.createDiv({ cls: "archivist-inquiry-stat-block" });
          renderGeneratedBlock(bw, { type: block.entityType, data: block.data });
          break;
        }
        case "footer":
          renderResponseFooter(wrapper, block.durationMs);
          break;
      }
    }
    // Copy button for full text content
    if (message.content) {
      const copyBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-copy" });
      setIcon(copyBtn, "copy");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(message.content);
        setIcon(copyBtn, "check");
        setTimeout(() => setIcon(copyBtn, "copy"), 2000);
      });
    }
    if (callbacks?.onFork) {
      const forkBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-fork" });
      setIcon(forkBtn, "git-branch");
      forkBtn.setAttribute("title", "Fork from here");
      forkBtn.addEventListener("click", () => callbacks.onFork!(message.id));
    }
    return wrapper;
  }

  // Fallback: old-style rendering for messages saved before contentBlocks existed
  if (message.content) {
    const textDiv = wrapper.createDiv({ cls: "archivist-inquiry-msg-text" });
    MarkdownRenderer.render(app, message.content, textDiv, sourcePath, comp);
    enhanceCodeBlocks(textDiv);
    const copyBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-copy" });
    setIcon(copyBtn, "copy");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(message.content);
      setIcon(copyBtn, "check");
      setTimeout(() => setIcon(copyBtn, "copy"), 2000);
    });
  }
  if (message.generatedEntity) {
    const blockWrapper = wrapper.createDiv({ cls: "archivist-inquiry-stat-block" });
    renderGeneratedBlock(blockWrapper, message.generatedEntity);
  }
  if (callbacks?.onFork) {
    const forkBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-fork" });
    setIcon(forkBtn, "git-branch");
    forkBtn.setAttribute("title", "Fork from here");
    forkBtn.addEventListener("click", () => callbacks.onFork!(message.id));
  }
  return wrapper;
}

export function renderToolCallMessage(parent: HTMLElement, toolName: string, toolInput?: Record<string, unknown>, isComplete = true): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-tool-call" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-tool-call-header" });
  const iconEl = header.createSpan({ cls: "archivist-inquiry-tool-call-icon" });
  setIcon(iconEl, getToolIcon(toolName));
  header.createSpan({ cls: "archivist-inquiry-tool-call-name", text: toolName.replace("mcp__archivist__", "") });
  if (toolInput) {
    const summary = getToolSummary(toolName, toolInput);
    if (summary) header.createSpan({ cls: "archivist-inquiry-tool-call-summary", text: summary });
  }
  const statusEl = header.createSpan({ cls: "archivist-inquiry-tool-call-status" });
  if (isComplete) { setIcon(statusEl, "check"); statusEl.addClass("archivist-inquiry-tool-status-done"); }
  else { statusEl.addClass("archivist-inquiry-tool-status-running"); }
  return wrapper;
}

export function renderErrorMessage(parent: HTMLElement, errorText: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-error" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-msg-error-icon" });
  setIcon(iconEl, "alert-circle");
  wrapper.createSpan({ text: errorText });
  return wrapper;
}

// ─── Flavor text arrays ─────────────────────────────────────────────────────

const THINKING_FLAVORS = [
  "Thinking", "Pondering", "Consulting the tomes", "Searching the archives",
  "Brewing ideas", "Leafing through scrolls", "Deciphering runes",
];

const COMPLETION_FLAVORS = [
  "Crafted", "Conjured", "Forged", "Brewed", "Unearthed",
  "Transcribed", "Inscribed", "Deciphered", "Compiled",
];

// ─── Streaming components ────────────────────────────────────────────────────

export interface ThinkingBlockHandle {
  el: HTMLElement;
  appendContent(text: string): void;
  finalize(): void;
}

export function renderThinkingBlock(parent: HTMLElement, app: App, sourcePath: string, component?: Component): ThinkingBlockHandle {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-thinking-block" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-thinking-header" });
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "false");
  const flavor = THINKING_FLAVORS[Math.floor(Math.random() * THINKING_FLAVORS.length)];
  const label = header.createSpan({ cls: "archivist-inquiry-thinking-label", text: `${flavor} 0s...` });
  const contentDiv = wrapper.createDiv({ cls: "archivist-inquiry-thinking-content" });
  contentDiv.style.display = "none";

  let accumulated = "";
  let seconds = 0;
  const timer = setInterval(() => {
    seconds++;
    label.textContent = `${flavor} ${seconds}s...`;
  }, 1000);

  // Toggle collapse
  header.addEventListener("click", () => {
    const isExpanded = contentDiv.style.display !== "none";
    contentDiv.style.display = isExpanded ? "none" : "";
    header.setAttribute("aria-expanded", String(!isExpanded));
  });

  return {
    el: wrapper,
    appendContent(text: string) {
      accumulated += text;
      contentDiv.empty();
      MarkdownRenderer.render(app, accumulated, contentDiv, sourcePath, component ?? new Component());
    },
    finalize() {
      clearInterval(timer);
      label.textContent = `${flavor} for ${seconds}s`;
      wrapper.removeClass("archivist-inquiry-thinking-active");
      // Collapse on finalize
      contentDiv.style.display = "none";
      header.setAttribute("aria-expanded", "false");
    },
  };
}

export interface ToolCallBlockHandle {
  el: HTMLElement;
  setResult(content: string, isError: boolean): void;
  setStatus(status: "running" | "completed" | "error"): void;
  setSummary(toolInput: Record<string, unknown>): void;
}

export function renderToolCallBlock(parent: HTMLElement, toolName: string, toolCallId?: string): ToolCallBlockHandle {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-tool-block" });
  if (toolCallId) wrapper.setAttribute("data-tool-id", toolCallId);

  const header = wrapper.createDiv({ cls: "archivist-inquiry-tool-header" });
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "false");

  const iconEl = header.createSpan({ cls: "archivist-inquiry-tool-icon" });
  setIcon(iconEl, getToolIcon(toolName));

  const displayName = toolName.replace("mcp__archivist__", "");
  header.createSpan({ cls: "archivist-inquiry-tool-name", text: displayName });

  const summaryEl = header.createSpan({ cls: "archivist-inquiry-tool-summary" });

  const statusEl = header.createSpan({ cls: "archivist-inquiry-tool-status status-running" });
  const spinnerEl = statusEl.createSpan({ cls: "archivist-inquiry-tool-spinner" });
  setIcon(spinnerEl, "loader-2");

  const contentDiv = wrapper.createDiv({ cls: "archivist-inquiry-tool-content" });
  contentDiv.style.display = "none";
  contentDiv.textContent = "Running...";

  // Toggle collapse
  header.addEventListener("click", () => {
    const isExpanded = contentDiv.style.display !== "none";
    contentDiv.style.display = isExpanded ? "none" : "";
    header.setAttribute("aria-expanded", String(!isExpanded));
  });

  return {
    el: wrapper,
    setSummary(toolInput: Record<string, unknown>) {
      const summary = getToolSummary(toolName, toolInput);
      if (summary) summaryEl.textContent = summary;
    },
    setResult(content: string, isError: boolean) {
      contentDiv.empty();
      if (isDiffResult(toolName, content)) {
        renderDiffContent(contentDiv, toolName, content);
      } else if (isBashLikeOutput(toolName)) {
        renderBashOutput(contentDiv, content);
      } else {
        // Generic result display
        const pre = contentDiv.createEl("pre", { cls: "archivist-inquiry-tool-result-text" });
        const truncated = truncateText(content, 30);
        pre.textContent = truncated;
      }
      if (isError) {
        contentDiv.addClass("archivist-inquiry-tool-result-error");
      }
      // Auto-expand for errors
      if (isError) {
        contentDiv.style.display = "";
        header.setAttribute("aria-expanded", "true");
      }
    },
    setStatus(status: "running" | "completed" | "error") {
      statusEl.className = "archivist-inquiry-tool-status";
      statusEl.empty();
      if (status === "running") {
        statusEl.addClass("status-running");
        const s = statusEl.createSpan({ cls: "archivist-inquiry-tool-spinner" });
        setIcon(s, "loader-2");
      } else if (status === "completed") {
        statusEl.addClass("status-completed");
        setIcon(statusEl, "check");
      } else {
        statusEl.addClass("status-error");
        setIcon(statusEl, "x");
      }
    },
  };
}

export function renderDiffBlock(parent: HTMLElement, toolName: string, filePath: string, diffText: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-diff-block" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-diff-header" });
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "true");

  const iconEl = header.createSpan({ cls: "archivist-inquiry-diff-icon" });
  setIcon(iconEl, toolName.toLowerCase().includes("write") ? "file-plus" : "file-pen");
  header.createSpan({ cls: "archivist-inquiry-diff-name", text: toolName.includes("Write") ? "Write" : "Edit" });
  header.createSpan({ cls: "archivist-inquiry-diff-file", text: filePath });

  const lines = diffText.split("\n");
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++;
    if (line.startsWith("-") && !line.startsWith("---")) removed++;
  }

  const statsEl = header.createSpan({ cls: "archivist-inquiry-diff-stats" });
  if (added > 0) statsEl.createSpan({ cls: "archivist-inquiry-diff-added", text: `+${added}` });
  if (removed > 0) statsEl.createSpan({ cls: "archivist-inquiry-diff-removed", text: `-${removed}` });

  const statusIcon = header.createSpan({ cls: "archivist-inquiry-diff-status" });
  setIcon(statusIcon, "check");

  const contentDiv = wrapper.createDiv({ cls: "archivist-inquiry-diff-content" });

  // Render diff lines, max 20
  const diffLines = lines.filter(l => l.startsWith("+") || l.startsWith("-") || l.startsWith(" "));
  const maxLines = 20;
  const visibleLines = diffLines.slice(0, maxLines);
  for (const line of visibleLines) {
    const lineEl = contentDiv.createDiv({ cls: "archivist-inquiry-diff-line" });
    if (line.startsWith("+")) {
      lineEl.addClass("archivist-inquiry-diff-insert");
      lineEl.createSpan({ cls: "archivist-inquiry-diff-prefix", text: "+" });
      lineEl.createSpan({ cls: "archivist-inquiry-diff-text", text: line.slice(1) });
    } else if (line.startsWith("-")) {
      lineEl.addClass("archivist-inquiry-diff-delete");
      lineEl.createSpan({ cls: "archivist-inquiry-diff-prefix", text: "-" });
      lineEl.createSpan({ cls: "archivist-inquiry-diff-text", text: line.slice(1) });
    } else {
      lineEl.createSpan({ cls: "archivist-inquiry-diff-prefix", text: " " });
      lineEl.createSpan({ cls: "archivist-inquiry-diff-text", text: line.startsWith(" ") ? line.slice(1) : line });
    }
  }
  if (diffLines.length > maxLines) {
    contentDiv.createDiv({
      cls: "archivist-inquiry-diff-truncated",
      text: `... ${diffLines.length - maxLines} more lines`,
    });
  }

  // Toggle collapse
  header.addEventListener("click", () => {
    const isExpanded = contentDiv.style.display !== "none";
    contentDiv.style.display = isExpanded ? "none" : "";
    header.setAttribute("aria-expanded", String(!isExpanded));
  });

  return wrapper;
}

export function renderBashOutput(parent: HTMLElement, output: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-bash-output" });
  const pre = wrapper.createEl("pre");
  const lines = output.split("\n");
  const maxLines = 20;
  if (lines.length > maxLines) {
    pre.textContent = lines.slice(0, maxLines).join("\n") + `\n... ${lines.length - maxLines} more lines`;
  } else {
    pre.textContent = output;
  }
  return wrapper;
}

export function renderResponseFooter(parent: HTMLElement, durationMs: number): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-response-footer" });
  const formatted = formatDuration(durationMs);
  const flavor = COMPLETION_FLAVORS[Math.floor(Math.random() * COMPLETION_FLAVORS.length)];
  wrapper.createSpan({ text: `${flavor} in ${formatted}` });
  return wrapper;
}

// Keep the old indicator for backward compat in chat-messages.ts
export function renderThinkingIndicator(parent: HTMLElement): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-thinking" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-thinking-icon" });
  setIcon(iconEl, "loader-2");
  wrapper.createSpan({ text: "Thinking..." });
  return wrapper;
}

// ─── Entity rendering ────────────────────────────────────────────────────────

export interface GeneratedBlockHandle {
  el: HTMLElement;
  /** Update with final enriched data from tool result */
  updateFromResult(entityType: string, data: unknown): void;
}

export function renderBlockSkeleton(parent: HTMLElement, entityType: string): GeneratedBlockHandle {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-stat-block" });

  const skeleton = wrapper.createDiv({ cls: "archivist-inquiry-block-skeleton" });
  const label = entityType === "monster" ? "Monster" : entityType === "spell" ? "Spell" : "Item";
  skeleton.createDiv({ cls: "archivist-inquiry-block-skeleton-header", text: `Generating ${label}...` });
  skeleton.createDiv({ cls: "archivist-inquiry-block-skeleton-line" });
  skeleton.createDiv({ cls: "archivist-inquiry-block-skeleton-line archivist-inquiry-block-skeleton-short" });
  skeleton.createDiv({ cls: "archivist-inquiry-block-skeleton-line" });

  return {
    el: wrapper,
    updateFromResult(eType: string, data: unknown) {
      wrapper.empty();
      renderGeneratedBlock(wrapper, { type: eType, data });
    },
  };
}

// ─── Saved-state rendering (for tab switching / reopening) ──────────────────

function renderSavedThinkingBlock(parent: HTMLElement, content: string, app: App, sourcePath: string, component: Component): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-thinking-block" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-thinking-header" });
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "false");
  header.createSpan({ cls: "archivist-inquiry-thinking-label", text: "Thought process" });
  const contentDiv = wrapper.createDiv({ cls: "archivist-inquiry-thinking-content" });
  contentDiv.style.display = "none";
  MarkdownRenderer.render(app, content, contentDiv, sourcePath, component);
  enhanceCodeBlocks(contentDiv);
  header.addEventListener("click", () => {
    const isExpanded = contentDiv.style.display !== "none";
    contentDiv.style.display = isExpanded ? "none" : "";
    header.setAttribute("aria-expanded", String(!isExpanded));
  });
  return wrapper;
}

function renderSavedToolCallBlock(parent: HTMLElement, toolName: string, toolInput: Record<string, unknown>, toolResult?: string, isError?: boolean): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-tool-block" });
  const header = wrapper.createDiv({ cls: "archivist-inquiry-tool-header" });
  header.setAttribute("tabindex", "0");
  header.setAttribute("role", "button");
  header.setAttribute("aria-expanded", "false");

  const iconEl = header.createSpan({ cls: "archivist-inquiry-tool-icon" });
  setIcon(iconEl, getToolIcon(toolName));
  const displayName = toolName.replace("mcp__archivist__", "");
  header.createSpan({ cls: "archivist-inquiry-tool-name", text: displayName });
  const summary = getToolSummary(toolName, toolInput);
  if (summary) header.createSpan({ cls: "archivist-inquiry-tool-summary", text: summary });

  const statusEl = header.createSpan({ cls: "archivist-inquiry-tool-status" });
  if (isError) {
    statusEl.addClass("status-error");
    setIcon(statusEl, "x");
  } else {
    statusEl.addClass("status-completed");
    setIcon(statusEl, "check");
  }

  const contentDiv = wrapper.createDiv({ cls: "archivist-inquiry-tool-content" });
  contentDiv.style.display = "none";
  if (toolResult) {
    if (isDiffResult(toolName, toolResult)) {
      renderDiffContent(contentDiv, toolName, toolResult);
    } else if (isBashLikeOutput(toolName)) {
      renderBashOutput(contentDiv, toolResult);
    } else {
      const pre = contentDiv.createEl("pre", { cls: "archivist-inquiry-tool-result-text" });
      pre.textContent = truncateText(toolResult, 30);
    }
    if (isError) contentDiv.addClass("archivist-inquiry-tool-result-error");
  }

  header.addEventListener("click", () => {
    const isExpanded = contentDiv.style.display !== "none";
    contentDiv.style.display = isExpanded ? "none" : "";
    header.setAttribute("aria-expanded", String(!isExpanded));
  });

  return wrapper;
}

/**
 * Normalize entity data from AI tool results through the same YAML-round-trip
 * parsing that code-fence blocks use. This ensures the data matches the typed
 * interfaces (Monster, Spell, Item) that renderers expect, fixing mismatches
 * between the raw AI output and the strict types (e.g. ac as number vs array).
 */
function normalizeEntityData(entityType: string, data: unknown): unknown {
  try {
    // Convert to YAML then parse through the typed parser, same as code fences
    const yamlStr = yaml.dump(data, { lineWidth: -1 });
    switch (entityType) {
      case "monster": {
        const result = parseMonster(yamlStr);
        return result.success ? result.data : data;
      }
      case "spell": {
        const result = parseSpell(yamlStr);
        return result.success ? result.data : data;
      }
      case "item": {
        const result = parseItem(yamlStr);
        return result.success ? result.data : data;
      }
      default: return data;
    }
  } catch {
    return data; // fallback to raw data if normalization fails
  }
}

export function renderGeneratedBlock(parent: HTMLElement, entity: { type: string; data: unknown }): void {
  try {
    const normalized = normalizeEntityData(entity.type, entity.data);
    switch (entity.type) {
      case "monster": parent.appendChild(renderMonsterBlock(normalized as any)); break;
      case "spell": parent.appendChild(renderSpellBlock(normalized as any)); break;
      case "item": parent.appendChild(renderItemBlock(normalized as any)); break;
      default:
        parent.createEl("pre", { cls: "archivist-inquiry-json" }).textContent = JSON.stringify(entity.data, null, 2);
    }
  } catch (err) {
    console.error("[archivist] Failed to render generated block:", err, entity);
    parent.createDiv({ cls: "archivist-inquiry-msg-error", text: "Failed to render block" });
  }

  const copyBtn = parent.createDiv({ cls: "archivist-inquiry-block-copy" });
  const copyIcon = copyBtn.createSpan();
  setIcon(copyIcon, "clipboard-copy");
  copyBtn.createSpan({ text: "Copy to Clipboard" });
  copyBtn.addEventListener("click", () => {
    const fenceType = entity.type;
    const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
    navigator.clipboard.writeText(`\`\`\`${fenceType}\n${yamlStr}\`\`\``);
    copyBtn.empty();
    const checkIcon = copyBtn.createSpan();
    setIcon(checkIcon, "check");
    copyBtn.createSpan({ text: "Copied!" });
    setTimeout(() => {
      copyBtn.empty();
      const icon2 = copyBtn.createSpan();
      setIcon(icon2, "clipboard-copy");
      copyBtn.createSpan({ text: "Copy to Clipboard" });
    }, 2000);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getToolIcon(toolName: string): string {
  const name = toolName.replace("mcp__archivist__", "").toLowerCase();
  if (name === "read" || name === "file-text") return "file-text";
  if (name === "write") return "file-plus";
  if (name === "edit") return "file-pen";
  if (name === "bash") return "terminal";
  if (name === "glob") return "folder-search";
  if (name === "grep") return "search";
  if (name === "websearch" || name === "web_search") return "globe";
  if (name === "webfetch" || name === "web_fetch") return "download";
  if (name === "agent" || name === "task") return "bot";
  if (name.startsWith("mcp__")) return "wand-2";
  // Archivist MCP tools
  if (name.includes("search")) return "search";
  if (name.includes("get")) return "book-open";
  if (name.includes("generate")) return "wand-2";
  return "wrench";
}

export function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  const name = toolName.replace("mcp__archivist__", "").toLowerCase();
  // File-related tools
  if ((name === "read" || name === "write" || name === "edit") && input.file_path) {
    return String(input.file_path).split("/").pop() ?? "";
  }
  // Bash
  if (name === "bash" && input.command) {
    const cmd = String(input.command);
    return cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd;
  }
  // Glob
  if (name === "glob" && input.pattern) return String(input.pattern);
  // Grep
  if (name === "grep" && input.pattern) return String(input.pattern);
  // WebSearch
  if ((name === "websearch" || name === "web_search") && input.query) return String(input.query);
  // Archivist MCP tools
  if (name === "search_srd") return `"${input.query}"`;
  if (name === "get_srd_entity") return `"${input.name}"`;
  if ((name === "generate_monster" || name === "generate_spell" || name === "generate_item") && input.yaml) {
    // Extract name from YAML string
    const nameMatch = String(input.yaml).match(/^name:\s*(.+)/m);
    if (nameMatch) return `"${nameMatch[1].trim()}"`;
  }
  if (name === "generate_monster" && input.monster) return `"${(input.monster as any).name}"`;
  if (name === "generate_spell" && input.spell) return `"${(input.spell as any).name}"`;
  if (name === "generate_item" && input.item) return `"${(input.item as any).name}"`;
  return "";
}

function isDiffResult(toolName: string, content: string): boolean {
  const name = toolName.replace("mcp__archivist__", "").toLowerCase();
  if (name !== "edit" && name !== "write") return false;
  // Check if content looks like a diff
  return content.includes("+++") || content.includes("---") || /^[-+]\s/m.test(content);
}

function isBashLikeOutput(toolName: string): boolean {
  const name = toolName.replace("mcp__archivist__", "").toLowerCase();
  return name === "bash" || name === "terminal";
}

function renderDiffContent(parent: HTMLElement, toolName: string, content: string): void {
  // Try to extract file path from diff header
  let filePath = "";
  const headerMatch = content.match(/^[+-]{3}\s+[ab]\/(.+)$/m);
  if (headerMatch) filePath = headerMatch[1];

  renderDiffBlock(parent, toolName, filePath, content);
}

function truncateText(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + `\n... ${lines.length - maxLines} more lines`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
